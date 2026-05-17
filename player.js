/* =========================================================
   player.js – Anime detail + watch page logic
   Handles: anime info, episodes list, video player,
            progress saving, favorites/watchlist
   ========================================================= */

// ── State ────────────────────────────────────────────────
let currentAnime  = null;   // normalized AniList object
let allEpisodes   = [];     // full episode list from Consumet
let filteredEps   = [];     // filtered by search
let currentEpIdx  = 0;      // index into filteredEps
let provider      = null;   // 'aniwatch' | 'gogoanime'
let progressTimer = null;   // setInterval for saving progress
const video       = document.getElementById('main-video');
const iframeBox   = document.getElementById('iframe-container');
const streamFrame = document.getElementById('stream-iframe');
const playerMsg   = document.getElementById('player-loading');

// ── URL Params ───────────────────────────────────────────
const params  = new URLSearchParams(location.search);
const animeId = params.get('id');
const startEp = parseInt(params.get('ep') || '0');

if (!animeId) {
  document.body.innerHTML = '<p style="padding:40px;color:#888">No anime ID provided. <a href="index.html">Go home</a></p>';
  throw new Error('No anime ID');
}

// ── Search bar (shared) ──────────────────────────────────
const searchInput = document.getElementById('search-input');
const searchBox   = document.getElementById('search-results');
let searchTimeout = null;

if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchBox.classList.add('hidden'); return; }
    searchTimeout = setTimeout(async () => {
      const res = await searchAnime(q);
      renderSearchResults(res, searchBox);
    }, 350);
  });
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchBox.contains(e.target)) {
      searchBox.classList.add('hidden');
    }
  });
}

// ── Escape helper ─────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ─────────────────────────────────────────────────
async function init() {
  try {
    // 1. Load anime details from AniList
    currentAnime = await getAnimeById(animeId);
    renderDetails(currentAnime);

    // 2. Load episodes from Consumet
    const result = await fetchEpisodes(currentAnime.title, animeId);
    provider = result.provider;
    allEpisodes = result.episodes;
    filteredEps = [...allEpisodes];
    renderEpisodeList(filteredEps);

    document.getElementById('player-section').classList.remove('hidden');

    // 3. Resume or start from requested episode
    const history = getProgress(animeId);
    const targetEp = startEp || (history ? history.episode : 1);
    const idx = allEpisodes.findIndex(e => e.number === targetEp);
    if (idx !== -1) {
      currentEpIdx = idx;
      await loadEpisode(idx, history?.currentTime || 0);
    }

  } catch (e) {
    console.error('Init failed:', e);
    document.getElementById('details-loading').textContent = 'Failed to load anime info. ' + e.message;
  }
}

// ── Render Anime Details ─────────────────────────────────
function renderDetails(anime) {
  document.title = `${anime.title} – AniStream`;

  // Banner
  if (anime.banner) {
    const banner = document.getElementById('anime-banner');
    banner.style.backgroundImage = `url(${anime.banner})`;
    banner.classList.remove('hidden');
  }

  // Poster & info
  document.getElementById('anime-poster').src = anime.image;
  document.getElementById('anime-poster').alt = anime.title;
  document.getElementById('anime-title').textContent = anime.title;
  document.getElementById('anime-desc').textContent = anime.description || 'No description available.';

  // Meta
  const meta = document.getElementById('anime-meta');
  meta.innerHTML = [
    anime.format       ? `<span>${anime.format}</span>`         : '',
    anime.year         ? `<span>${anime.year}</span>`           : '',
    anime.season       ? `<span>${anime.season}</span>`         : '',
    anime.episodes     ? `<span>${anime.episodes} eps</span>`   : '',
    anime.status       ? `<span>${anime.status}</span>`         : '',
    anime.score        ? `<span>⭐ ${anime.score / 10}/10</span>` : ''
  ].join('');

  // Genres
  const genreEl = document.getElementById('anime-genres');
  genreEl.innerHTML = anime.genres.map(g => `<span class="genre-tag">${escHtml(g)}</span>`).join('');

  document.getElementById('details-loading').classList.add('hidden');
  document.getElementById('details-content').classList.remove('hidden');

  // Favorite button
  const btnFav = document.getElementById('btn-favorite');
  updateFavBtn(btnFav);
  btnFav.addEventListener('click', () => toggleFavorite(anime, btnFav));

  // Watchlist button
  const btnWl = document.getElementById('btn-watchlist');
  updateWlBtn(btnWl);
  btnWl.addEventListener('click', () => toggleWatchlist(anime, btnWl));
}

// ── Render Episode List ──────────────────────────────────
function renderEpisodeList(episodes) {
  const list = document.getElementById('episode-list');
  if (!episodes.length) {
    list.innerHTML = '<div class="loading">No episodes found via Consumet API.<br>The provider may be unavailable.</div>';
    return;
  }

  list.innerHTML = '';
  episodes.forEach((ep, i) => {
    const div = document.createElement('div');
    div.className = 'ep-item';
    div.dataset.idx = i;

    // Find real index in allEpisodes for active check
    const realIdx = allEpisodes.indexOf(ep);
    if (realIdx === currentEpIdx) div.classList.add('active');

    const thumb = ep.image
      ? `<img class="ep-thumb" src="${ep.image}" alt="ep${ep.number}" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="ep-thumb-placeholder">${ep.number}</div>`;

    div.innerHTML = `
      ${thumb}
      <div class="ep-info">
        <div class="ep-num">Episode ${ep.number}</div>
        <div class="ep-title">${escHtml(ep.title || `Episode ${ep.number}`)}</div>
      </div>`;

    div.addEventListener('click', async () => {
      currentEpIdx = realIdx;
      await loadEpisode(currentEpIdx, 0);
      div.scrollIntoView({ block: 'nearest' });
    });

    list.appendChild(div);
  });
}

// Episode filter
document.getElementById('ep-search')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  filteredEps = q
    ? allEpisodes.filter(ep => String(ep.number).includes(q) || (ep.title || '').toLowerCase().includes(q))
    : [...allEpisodes];
  renderEpisodeList(filteredEps);
});

// ── Load & Play an Episode ───────────────────────────────
async function loadEpisode(idx, resumeTime = 0) {
  const ep = allEpisodes[idx];
  if (!ep) return;

  // Highlight active
  document.querySelectorAll('.ep-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.idx) === idx);
  });

  playerMsg.textContent = 'Loading stream…';
  playerMsg.style.display = 'flex';
  video.style.display = 'none';
  iframeBox.style.display = 'none';
  document.getElementById('custom-controls').classList.add('hidden');

  if (!provider) {
    playerMsg.textContent = 'No streaming provider available. Consumet API may be down.';
    return;
  }

  try {
    const { sources, headers } = await fetchStreamSources(ep.id, provider);

    if (!sources.length) {
      playerMsg.textContent = 'No streams found for this episode.';
      return;
    }

    // Prefer highest quality non-M3U8 first, then M3U8
    const mp4 = sources.find(s => !s.isM3U8);
    const m3u8 = sources.find(s => s.isM3U8);
    const chosen = mp4 || m3u8;

    if (chosen.isM3U8) {
      // HLS – try native, otherwise embed via iframe proxy
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        playInVideoTag(chosen.url, resumeTime);
      } else {
        // Use an iframe with the stream URL as a proxy approach
        playInIframe(chosen.url, ep);
      }
    } else {
      playInVideoTag(chosen.url, resumeTime);
    }

    // Start saving progress
    startProgressSave(ep);

  } catch (e) {
    console.error('Stream load failed:', e);
    playerMsg.textContent = 'Stream unavailable. The episode may not be accessible: ' + e.message;
  }
}

function playInVideoTag(url, resumeTime) {
  playerMsg.style.display = 'none';
  iframeBox.style.display = 'none';
  video.src = url;
  video.style.display = 'block';
  document.getElementById('custom-controls').classList.remove('hidden');
  video.load();
  video.addEventListener('loadedmetadata', () => {
    if (resumeTime > 0 && resumeTime < video.duration - 10) {
      video.currentTime = resumeTime;
    }
    video.play().catch(() => {}); // autoplay may be blocked
    updateTimeDisplay();
  }, { once: true });
}

function playInIframe(url, ep) {
  // When direct embedding isn't possible, open in new tab with a notice
  playerMsg.innerHTML = `
    <div>
      <p style="margin-bottom:12px">This stream requires HLS decoding not supported by your browser's native player.</p>
      <a href="${url}" target="_blank" rel="noopener" style="color:var(--accent)">▶ Open stream in new tab</a>
      <p style="margin-top:8px;font-size:12px;color:#888">Tip: Use a browser extension like "Native HLS Playback" to play .m3u8 directly.</p>
    </div>`;
  playerMsg.style.display = 'flex';
}

// ── Custom Controls ──────────────────────────────────────
document.getElementById('btn-skip-back')?.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
document.getElementById('btn-skip-fwd')?.addEventListener('click', () => { video.currentTime = Math.min(video.duration, video.currentTime + 10); });
document.getElementById('btn-prev-ep')?.addEventListener('click', () => { if (currentEpIdx > 0) loadEpisode(--currentEpIdx, 0); });
document.getElementById('btn-next-ep')?.addEventListener('click', () => { if (currentEpIdx < allEpisodes.length - 1) loadEpisode(++currentEpIdx, 0); });

// Auto-next
video.addEventListener('ended', () => {
  if (document.getElementById('auto-next')?.checked) {
    if (currentEpIdx < allEpisodes.length - 1) {
      setTimeout(() => loadEpisode(++currentEpIdx, 0), 1500);
    }
  }
});

// Time display
video.addEventListener('timeupdate', updateTimeDisplay);
function updateTimeDisplay() {
  const el = document.getElementById('time-display');
  if (!el) return;
  el.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration || 0)}`;
}
function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Progress Saving ──────────────────────────────────────
function startProgressSave(ep) {
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!video.duration || video.paused) return;
    saveProgress({
      animeId,
      title: currentAnime?.title || '',
      image: currentAnime?.image || '',
      episode: ep.number,
      currentTime: Math.floor(video.currentTime),
      duration: Math.floor(video.duration)
    });
  }, 5000); // save every 5 seconds
}

function saveProgress(data) {
  try {
    let history = JSON.parse(localStorage.getItem('anistream_history') || '[]');
    // Remove existing entry for this anime
    history = history.filter(h => h.animeId !== data.animeId);
    // Prepend latest
    history.unshift(data);
    // Keep only last 30
    history = history.slice(0, 30);
    localStorage.setItem('anistream_history', JSON.stringify(history));
  } catch(e) { console.warn('Progress save failed', e); }
}

function getProgress(id) {
  try {
    const history = JSON.parse(localStorage.getItem('anistream_history') || '[]');
    return history.find(h => h.animeId == id) || null;
  } catch { return null; }
}

// ── Favorites & Watchlist ────────────────────────────────
function getList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveList(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
function isInList(key, id) {
  return getList(key).some(a => a.id == id);
}

function toggleFavorite(anime, btn) {
  const key = 'anistream_favorites';
  let list = getList(key);
  if (isInList(key, anime.id)) {
    list = list.filter(a => a.id != anime.id);
  } else {
    list.unshift({ id: anime.id, title: anime.title, image: anime.image });
  }
  saveList(key, list);
  updateFavBtn(btn);
}

function toggleWatchlist(anime, btn) {
  const key = 'anistream_watchlist';
  let list = getList(key);
  if (isInList(key, anime.id)) {
    list = list.filter(a => a.id != anime.id);
  } else {
    list.unshift({ id: anime.id, title: anime.title, image: anime.image });
  }
  saveList(key, list);
  updateWlBtn(btn);
}

function updateFavBtn(btn) {
  const active = isInList('anistream_favorites', animeId);
  btn.textContent = active ? '★ Favorited' : '☆ Favorite';
  btn.classList.toggle('active', active);
}

function updateWlBtn(btn) {
  const active = isInList('anistream_watchlist', animeId);
  btn.textContent = active ? '✓ In Watchlist' : '+ Watchlist';
  btn.classList.toggle('active', active);
}

// ── Start ────────────────────────────────────────────────
init();

/* =========================================================
   app.js – Homepage logic for AniStream
   Handles: rendering grids, search, continue watching
   ========================================================= */

// ── Render an anime card ─────────────────────────────────
function createCard(anime, progress) {
  const a = document.createElement('a');
  a.href = `anime.html?id=${anime.id}`;
  a.className = 'anime-card';

  let progressBar = '';
  if (progress) {
    const pct = Math.min(100, Math.round((progress.currentTime / (progress.duration || 1)) * 100));
    const ep = progress.episode || 1;
    progressBar = `
      <div class="card-meta">Ep ${ep} · ${pct}%</div>
      <div class="card-progress"><div class="card-progress-bar" style="width:${pct}%"></div></div>`;
  }

  a.innerHTML = `
    <img src="${anime.image}" alt="${escHtml(anime.title)}" loading="lazy" />
    <div class="card-info">
      <div class="card-title">${escHtml(anime.title)}</div>
      <div class="card-meta">${anime.episodes} eps ${anime.year ? '· ' + anime.year : ''}</div>
      ${progressBar}
    </div>`;
  return a;
}

// ── Populate a grid section ──────────────────────────────
function populateGrid(gridId, animeList) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!animeList.length) {
    grid.innerHTML = '<p class="empty-msg">Nothing to show.</p>';
    return;
  }
  animeList.forEach(anime => grid.appendChild(createCard(anime)));
}

// ── Continue Watching (from localStorage) ───────────────
function loadContinueWatching() {
  const section = document.getElementById('continue-watching');
  const grid = document.getElementById('continue-grid');
  if (!section || !grid) return;

  const history = getWatchHistory();
  if (!history.length) return;

  section.classList.remove('hidden');
  grid.innerHTML = '';
  history.forEach(entry => {
    const a = document.createElement('a');
    a.href = `anime.html?id=${entry.animeId}&ep=${entry.episode}`;
    a.className = 'anime-card';
    const pct = Math.min(100, Math.round((entry.currentTime / (entry.duration || 1)) * 100));
    a.innerHTML = `
      <img src="${entry.image}" alt="${escHtml(entry.title)}" loading="lazy" />
      <div class="card-info">
        <div class="card-title">${escHtml(entry.title)}</div>
        <div class="card-meta">Ep ${entry.episode} · ${pct}%</div>
        <div class="card-progress"><div class="card-progress-bar" style="width:${pct}%"></div></div>
      </div>`;
    grid.appendChild(a);
  });
}

// ── localStorage helpers ─────────────────────────────────
function getWatchHistory() {
  try {
    return JSON.parse(localStorage.getItem('anistream_history') || '[]');
  } catch { return []; }
}

// ── Search ───────────────────────────────────────────────
let searchTimeout = null;
const searchInput = document.getElementById('search-input');
const searchBox   = document.getElementById('search-results');

if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchBox.classList.add('hidden'); return; }
    searchTimeout = setTimeout(async () => {
      const results = await searchAnime(q);
      renderSearchResults(results, searchBox);
    }, 350);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchBox.contains(e.target)) {
      searchBox.classList.add('hidden');
    }
  });
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  loadContinueWatching();

  try {
    const [trending, popular, recent] = await Promise.all([
      getTrending(1, 20),
      getPopular(1, 20),
      getRecentlyAdded(1, 20)
    ]);
    populateGrid('trending-grid', trending);
    populateGrid('popular-grid', popular);
    populateGrid('recent-grid', recent);
  } catch (e) {
    console.error('Failed to load homepage data:', e);
    ['trending-grid','popular-grid','recent-grid'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="empty-msg">Failed to load. Check your connection.</p>';
    });
  }
}

// ── Utility ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();

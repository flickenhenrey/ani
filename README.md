# AniStream – Anime Streaming Website

A clean, functional anime streaming site built with vanilla HTML/CSS/JS.

## APIs Used
- **AniList GraphQL API** – anime metadata (titles, descriptions, covers, genres)
- **Consumet API** – episode lists and stream sources (Aniwatch/Zoro + Gogoanime providers)

## File Structure
```
animestream/
├── index.html      — Homepage (trending, popular, recent, continue watching)
├── anime.html      — Anime detail + watch page with episode list & player
├── watchlist.html  — Favorites and watchlist page
├── style.css       — All styles (dark theme, responsive)
├── api.js          — AniList + Consumet API calls (shared)
├── app.js          — Homepage logic
├── player.js       — Watch page: details, episodes, video, progress
└── README.md
```

## How to Run

**Option 1 – Live Server (recommended)**
```bash
# With VS Code Live Server extension, right-click index.html → Open with Live Server
# OR with Node.js:
npx serve .
# OR with Python:
python -m http.server 8080
```
Then open `http://localhost:8080`

**Option 2 – Open directly**
Open `index.html` in a browser. Note: some browsers block local fetch requests.
Use a local server for best results.

## Features
- 🏠 Homepage with Trending / Popular / Recent grid sections
- 🔍 Live search via AniList API
- 📄 Anime detail page with banner, poster, genres, description
- 📺 Episode list from Consumet (Aniwatch provider first, Gogoanime fallback)
- ▶️  HTML5 video player with skip ±10s, prev/next episode, auto-next
- 💾 Automatic watch progress saved to localStorage (resume where you left off)
- ⭐ Favorites & Watchlist saved to localStorage
- 📱 Responsive – works on mobile and desktop

## Notes on Streaming
Consumet API is a third-party service. If streams fail:
- The public Consumet instance may be rate-limited or temporarily down
- HLS (.m3u8) streams may require a browser extension like "Native HLS Playback" (Chrome) or "Play HLS M3u8" to play directly in the browser
- For self-hosting, deploy your own Consumet instance: https://github.com/consumet/consumet.ts

## localStorage Keys
| Key | Contents |
|-----|----------|
| `anistream_history` | Array of watch progress objects |
| `anistream_favorites` | Array of favorited anime |
| `anistream_watchlist` | Array of watchlisted anime |

## Progress Save Format
```json
{
  "animeId": "21",
  "title": "One Piece",
  "image": "https://...",
  "episode": 5,
  "currentTime": 742,
  "duration": 1440
}
```

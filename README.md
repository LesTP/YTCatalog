# YTCatalog

A browser extension for organizing YouTube playlists into folders. Works in Chrome and Firefox.

---

## Cold Start Summary

- **What this is**: YTCatalog is a browser extension to organize YouTube playlists into custom folders with filtering and click-to-assign management
- **Current state**: Phase 8 in progress - Firefox compatibility implemented. Export/Import working. Grid layout gaps accepted as v1 limitation.
- **What works**:
  - Dropdown button on `/feed/playlists` matching YouTube's native chip design
  - Scroll-to-load triggers loading of all playlists (handles YouTube's lazy loading)
  - Scrapes 300+ playlists with IDs, titles, thumbnails, video counts
  - Filters by playlist ID prefix (PL, FL, LL, WL, OL, RD)
  - Create, rename, delete folders (validated: non-empty, no duplicates)
  - Folders persist to browser storage and display alphabetically
  - Selected folder persists across page reloads
  - Filtering shows/hides playlists based on folder selection
  - "Unassigned" computed dynamically (all playlists not in any folder)
  - Organization modal with folder sidebar and playlist grid
  - Click-to-assign: select playlist → click folder → playlist moves
  - MutationObserver handles YouTube's DOM recycling on sort/filter
  - Dropdown shows playlist counts per folder
  - Export/Import folders as JSON
- **What's next**: Thumbnail loading for off-screen playlists
- **Known limitation**: Grid has visual gaps when filtering (YouTube's flexbox doesn't reflow)
- **Key architecture**: Playlist metadata read from DOM (not cached); storage only holds folder→playlistID mappings; "unassigned" computed dynamically
- **Tech stack**: TypeScript, Webpack, Manifest V3, Chrome/Firefox Storage API
- **Testing**: Press `Ctrl+Shift+Y` on playlists page to trigger scraping test (see console)

---

## Browser Compatibility

| Feature | Chrome | Firefox |
|---------|--------|---------|
| Extension loading | ✅ | ✅ (109+) |
| Storage API | ✅ | ✅ |
| Content scripts | ✅ | ✅ |
| Service worker / Background | ✅ | ✅ |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [DEVPLAN.md](./DEVPLAN.md) | Product vision, roadmap, requirements, design specs, decisions |
| [DEVLOG.md](./DEVLOG.md) | Implementation history, issues encountered, lessons learned |
| [GOVERNANCE.txt](./GOVERNANCE.txt) | Repository rules and workflow guidelines |

---

## Quick Start

```bash
# Clone/create project directory
cd YTCatalog

# Install dependencies
npm install

# Build the extension
npm run build
```

### Chrome Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Firefox Installation

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist/manifest.json`

> **Note**: Firefox temporary add-ons are removed when Firefox closes. For persistent installation, the extension must be signed and installed from AMO.

### Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Run in Firefox with web-ext (auto-reload)
npm run dev:firefox
```

After rebuilding:
- **Chrome**: Click the refresh icon on the extension card in `chrome://extensions/`, then refresh YouTube
- **Firefox**: Click "Reload" in `about:debugging`, then refresh YouTube

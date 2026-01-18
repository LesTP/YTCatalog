# YTCatalog

A browser extension for organizing YouTube playlists into folders.

---

## Cold Start Summary

- **What this is**: YTCatalog is a browser extension to organize YouTube playlists into custom folders with filtering and click-to-assign management
- **Current state**: Phase 6 complete - Export/Import folders functionality working. Phases 7-8 defined.
- **What works**:
  - Dropdown button on `/feed/playlists` matching YouTube's native chip design
  - Scroll-to-load triggers loading of all playlists (handles YouTube's lazy loading)
  - Scrapes 300+ playlists with IDs, titles, thumbnails, video counts
  - Filters by playlist ID prefix (PL, FL, LL, WL, OL, RD)
  - Create, rename, delete folders (validated: non-empty, no duplicates)
  - Folders persist to Chrome storage and display alphabetically
  - Selected folder persists across page reloads
  - Filtering shows/hides playlists based on folder selection
  - "Unassigned" computed dynamically (all playlists not in any folder)
  - Organization modal with folder sidebar and playlist grid
  - Click-to-assign: select playlist → click folder → playlist moves
  - MutationObserver handles YouTube's DOM recycling on sort/filter
  - Dropdown shows playlist counts per folder
- **What's next**: Phase 7 (Grid Layout Fix) → Phase 8 (Firefox Compatibility)
- **Key architecture**: Playlist metadata read from DOM (not cached); storage only holds folder→playlistID mappings; "unassigned" computed dynamically
- **Key constraint**: Chrome Manifest V3; dropdown uses `position: fixed` to escape YouTube's overflow clipping
- **Tech stack**: TypeScript, Webpack, Chrome Storage API
- **Testing**: Press `Ctrl+Shift+Y` on playlists page to trigger scraping test (see console)

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

# Load in Chrome: chrome://extensions/ → Developer mode → Load unpacked → select dist/
```

See [dev-setup-guide.md](./dev-setup-guide.md) for detailed setup instructions.

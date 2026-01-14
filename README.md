# YTCatalog

A browser extension for organizing YouTube playlists into folders.

---

## Cold Start Summary

- **What this is**: YTCatalog is a browser extension to organize YouTube playlists into custom folders with filtering and drag-and-drop management
- **Current state**: Phase 4 complete - filtering works with storage-based folder assignments
- **What works**:
  - Dropdown button on `/feed/playlists` matching YouTube's native chip design
  - Scroll-to-load triggers loading of all playlists (handles YouTube's lazy loading)
  - Scrapes 300+ playlists with IDs, titles, thumbnails, video counts
  - Filters by playlist ID prefix (PL, FL, LL, WL, OL, RD)
  - Create folders via "+ New Folder" (validated: non-empty, no duplicates)
  - Folders persist to Chrome storage and display alphabetically
  - Selected folder persists across page reloads
  - Filtering shows/hides playlists based on folder selection
  - "Unassigned" computed dynamically (all playlists not in any folder)
  - Deleted folder handling (silent reset to All Playlists)
- **What's next**: Phase 5 - Organization Modal (assign playlists to folders, rename/delete folders)
- **Key architecture**: Playlist metadata read from DOM (not cached); storage only holds folder→playlistID mappings; "unassigned" computed dynamically
- **Key constraint**: Chrome Manifest V3; dropdown uses `position: fixed` to escape YouTube's overflow clipping
- **Tech stack**: TypeScript, Webpack, Chrome Storage API
- **Testing**: Press `Ctrl+Shift+Y` on playlists page to trigger scraping test (see console)

---

## TODO (Phase 6 / Post-MVP)

- [ ] **Firefox support**: Use webextension-polyfill or conditional API code (`chrome.storage` → `browser.storage`)
- [ ] **Export/Import folders**: Download folders as JSON, import from JSON file (alternative to cloud sync)
- [ ] **Remove/hide test hotkey**: Remove `Ctrl+Shift+Y` testing feature or hide behind debug flag

---

## Documentation

| Document | Purpose |
|----------|---------|
| [DEVPLAN.md](./DEVPLAN.md) | Product vision, roadmap, requirements, design specs, decisions |
| [DEVLOG.md](./DEVLOG.md) | Implementation history, issues encountered, lessons learned |
| [YTCatalog-doc.md](./YTCatalog-doc.md) | Detailed product specification and UI design |
| [dev-setup-guide.md](./dev-setup-guide.md) | Development environment setup and configuration |
| [META.txt](./META.txt) | Repository rules and workflow guidelines |

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

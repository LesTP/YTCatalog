# YTCatalog

A browser extension for organizing YouTube playlists into folders.

---

## Cold Start Summary

- **What this is**: YTCatalog is a browser extension to organize YouTube playlists into custom folders with filtering and click-to-assign management
- **Current state**: Phase 5 complete - full organization modal with playlist assignment working
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
- **What's next**: Phase 6 - Polish (grid layout gaps, Firefox support, export/import)
- **Key architecture**: Playlist metadata read from DOM (not cached); storage only holds folder→playlistID mappings; "unassigned" computed dynamically
- **Key constraint**: Chrome Manifest V3; dropdown uses `position: fixed` to escape YouTube's overflow clipping
- **Tech stack**: TypeScript, Webpack, Chrome Storage API
- **Testing**: Press `Ctrl+Shift+Y` on playlists page to trigger scraping test (see console)

---

## TODO (Phase 6 / Post-MVP)

**Top Priority:**
- [ ] **Grid layout gaps**: YouTube's CSS doesn't reflow hidden items properly
- [ ] **Firefox support**: Use webextension-polyfill or conditional API code
- [ ] **Export/Import folders**: Download/upload folder structure as JSON
- [ ] **Thumbnail loading**: Off-screen playlist thumbnails don't load (YouTube lazy-loading)

**Medium Priority:**
- [ ] **Bulk operations**: Multi-select playlists + bulk move to folder
- [ ] **Drag-and-drop**: Add as alternative to click-to-assign

**Nice to Have:**
- [ ] **Remove/hide test hotkey**: Remove `Ctrl+Shift+Y` or hide behind debug flag

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

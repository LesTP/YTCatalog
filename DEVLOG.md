# YTCatalog - Development Log

This document tracks implementation history, issues encountered, and lessons learned.

---

## Log Format

Each entry follows this structure:

```
## [Date] Phase X.Y: Description

### What was done
- Bullet points of changes made

### Issues encountered
- Problems faced and how they were resolved

### Lessons learned
- Insights for future development

### Files changed
- List of files added/modified/deleted
```

---

## Implementation History

### [2026-01-12] Project Initialization

#### What was done
- Created project documentation structure
- Established META.txt with development rules and workflow
- Created YTCatalog-doc.md with full product specification
- Created dev-setup-guide.md with environment setup instructions
- Created README.md, DEVPLAN.md, DEVLOG.md per META.txt structure
- Defined 5-phase development roadmap
- Documented 4 architectural decisions (D-1 through D-4)

#### Issues encountered
- Minor naming inconsistencies between docs (extension/ vs YTCatalog/, ytcatalog vs YTCatalog)
- Manifest V2 permission pattern in original doc needed updating to V3 format

#### Lessons learned
- Establish consistent naming conventions early
- Manifest V3 requires `host_permissions` separate from `permissions`

#### Files changed
- Added: `README.md`, `DEVPLAN.md`, `DEVLOG.md`
- Modified: `YTCatalog-doc.md`, `dev-setup-guide.md`

---

### [2026-01-12] Phase 1a: Environment Setup

#### What was done
- Ran `npm init -y` to create package.json
- Installed dev dependencies: typescript, webpack, webpack-cli, ts-loader, @types/chrome, copy-webpack-plugin, css-loader, style-loader, web-ext
- Updated package.json with build scripts (build, watch, dev)
- Created tsconfig.json with TypeScript compiler settings
- Created webpack.config.js with entry points, loaders, and copy plugin

#### Issues encountered
- None

#### Lessons learned
- Webpack 5 with ts-loader works smoothly for browser extension builds

#### Files changed
- Added: `tsconfig.json`, `webpack.config.js`
- Modified: `package.json`
- Generated: `package-lock.json`, `node_modules/`

---

### [2026-01-12] Phase 1b: Source Files Creation

#### What was done
- Created `src/manifest.json` with Manifest V3 configuration
- Created `src/background/service-worker.ts` with installation and message handling
- Created `src/content/youtube.ts` with playlist page detection and SPA navigation handling
- Created `src/shared/types.ts` with Folder, StorageState, and message interfaces
- Created `src/shared/storage.ts` with FolderStorage class and CRUD operations
- Created `src/styles/dropdown.css` with YouTube-matching styles
- Successfully built extension to `dist/` folder

#### Issues encountered
- TypeScript strict mode error: `{}` not assignable to `Record<string, Folder>`
- Fixed by adding explicit type assertions for chrome.storage.local.get results

#### Lessons learned
- Chrome storage API returns untyped objects; explicit type assertions needed with strict mode
- YouTube uses `yt-navigate-finish` event for SPA navigation detection

#### Files changed
- Added: `src/manifest.json`, `src/background/service-worker.ts`, `src/content/youtube.ts`, `src/shared/types.ts`, `src/shared/storage.ts`, `src/styles/dropdown.css`
- Generated: `dist/` folder with compiled extension

---

### [2026-01-12] Phase 1c: YouTube Integration Test

#### What was done
- Identified correct page: `/feed/playlists` (not individual playlist pages)
- Found injection point: `chip-bar-view-model.ytChipBarViewModelHost`
- Discovered YouTube's chip structure uses custom elements: `chip-view-model`, `chip-shape`, etc.
- Updated dropdown to match YouTube's native chip design exactly
- Used YouTube's own CSS classes: `ytChipShapeChip`, `ytChipShapeInactive`, `ytChipShapeEndIconPadding`
- Used YouTube's SVG dropdown arrow icon
- Implemented fixed positioning for dropdown menu to escape `overflow: hidden` parents
- Dropdown button now visually matches YouTube's "Recently added" sort button

#### Issues encountered
- Initial selectors didn't match YouTube's actual DOM structure
- Dropdown menu was hidden due to parent elements having `overflow: hidden`
- Fixed by using `position: fixed` and calculating position via JavaScript

#### Lessons learned
- YouTube playlists library is at `/feed/playlists`, not `/playlist?list=`
- YouTube uses custom web components (`chip-bar-view-model`, `chip-view-model`, etc.)
- Matching YouTube's exact HTML structure and classes provides seamless integration
- `position: fixed` with JS positioning is needed to escape clipped containers

#### Stable selectors documented
```javascript
// Chip bar (contains filter chips)
'chip-bar-view-model.ytChipBarViewModelHost'

// Individual chip wrapper
'.ytChipBarViewModelChipWrapper'

// Page detection
/youtube\.com\/feed\/playlists/
```

#### Files changed
- Modified: `src/content/youtube.ts` (complete rewrite of dropdown creation)
- Modified: `src/styles/dropdown.css` (simplified, uses YouTube classes)

---

### [2026-01-13] Phase 2: Playlist Scraping

#### What was done
- Implemented scroll-to-load functionality to trigger loading of all playlists
- Created playlist scraping logic to extract IDs, titles, thumbnails, and video counts from DOM
- Identified stable DOM selectors for YouTube's playlist page structure
- Implemented playlist ID prefix filtering to distinguish user playlists from videos/auto-generated content
- Added testing shortcut (Ctrl+Shift+Y) to manually trigger scraping for debugging
- Successfully tested with 300+ playlists

#### Issues encountered
1. **Content script isolation**: Cannot expose functions to page's `window` object from content scripts
   - Fixed by using keyboard shortcut (Ctrl+Shift+Y) to trigger testing instead

2. **Scraping videos instead of playlists**: Initial implementation scraped video IDs
   - Fixed by adding `isUserPlaylistId()` filter based on playlist ID prefixes

3. **Container scoping confusion**: YouTube has TWO `ytd-rich-grid-renderer #contents` elements:
   - One with `page-subtype="home"` for recommendations
   - One without for actual playlists
   - Fixed by using `:not([page-subtype="home"])` selector

4. **Album playlists (OL prefix) being excluded**: User reported saved albums not appearing
   - Fixed by adding `OL` prefix to allowed list (official/album playlists from YouTube Music)

#### Lessons learned
- YouTube's playlist IDs have semantic prefixes: PL (user-created), FL (favorites), LL (liked), WL (watch later), OL (albums), RD (mixes), UU (uploads)
- Prefix filtering is more reliable than container scoping for distinguishing playlist types
- Always check for multiple containers on YouTube pages - they reuse components
- Debugging with console logging is essential; added skipped items logging for visibility

#### Key decisions documented
- D-6: Container scoping with `:not([page-subtype="home"])`
- D-7: Playlist ID prefix filtering (PL, FL, LL, WL, OL, RD included; UU excluded)

#### Files changed
- Modified: `src/content/youtube.ts` (scroll-to-load, scraping logic, ID filtering)
- Modified: `DEVPLAN.md` (Phase 2 completion, D-6 and D-7 decisions)

---

### [2026-01-14] Phase 4b: Storage-based Filtering

#### What was done
- Removed all Phase 4a hard-coded test logic:
  - Removed `TEST_FOLDER_MUSIC` and `TEST_FOLDER_ART` constants
  - Removed `getTestFolderIdForPlaylist()` function
  - Removed test folder hard-coding from `buildMenuItems()` and `getFolderLabel()`
- Added storage-based folder lookup:
  - Added `getFolderIdForPlaylist(playlistId, folders)` - looks up playlist in folder's `playlistIds` array
  - Added `seedTestFolders()` - creates Music/Art folders with SWAPPED assignments (OL→Art, RD→Music)
- Modified `applyFolderFilter()`:
  - Loads folders from storage
  - Uses `getFolderIdForPlaylist()` for lookup
  - Handles deleted folder edge case: silent reset to All Playlists + dropdown refresh
- Modified `initializeFilterOnLoad()` to call `seedTestFolders()` and `refreshDropdownMenu()`

#### Issues encountered
1. **Wrong playlists shown after seeding**: Initially, playlists shown didn't match RD/OL prefixes
   - Cause: User had old Music/Art folders from Phase 3 with stale data
   - Fix: Added extensive debug logging to verify seeding; clearing storage resolved issue

2. **Deleted folder remained in dropdown**: After deleting folder via DevTools, it still appeared in dropdown
   - Cause: `applyFolderFilter()` updated label but didn't refresh menu
   - Fix: Added `await refreshDropdownMenu()` after detecting deleted folder

3. **Deleted folders recreated on navigation**: After deleting a folder, navigating away and back recreated it
   - Cause: `seedTestFolders()` runs on every page load and recreates Music/Art if missing
   - Resolution: Expected temporary behavior for Phase 4b testing; will be removed in Phase 5

#### Testing (All 8 tests passed)
- [x] After seed: Music folder contains RD playlists (opposite of 4a)
- [x] After seed: Art folder contains OL playlists (opposite of 4a)
- [x] Select "Music" → only RD-prefixed playlists visible (swapped)
- [x] Select "Art" → only OL-prefixed playlists visible (swapped)
- [x] Select "Unassigned" → only PL/FL/LL/WL playlists visible
- [x] Select "All Playlists" → all playlists visible
- [x] Reload page → folders and assignments persist
- [x] Delete selected folder, reload → resets to All Playlists, folder removed from dropdown

#### Lessons learned
- Storage-based testing benefits from swapped assignments to visually confirm different behavior from hard-coded logic
- Debug logging with verification steps (`VERIFY` logs) helps diagnose seeding issues
- Deleted folder handling needs both label update AND menu refresh

#### Files changed
- Modified: `src/content/youtube.ts` (removed test code, added storage-based lookup, seeding, deleted folder handling)
- Modified: `DEVPLAN.md` (Phase 4b specification and testing results)

---

### [2026-01-14] Phase 4a: Hard-coded Filtering

#### What was done
- Added playlist caching: `cachedPlaylists` variable, `ensurePlaylistsCached()`, `clearPlaylistCache()`
- Added prefix-based test assignments: `getTestFolderIdForPlaylist()` (OL→Music, RD→Art)
- Added filtering logic: `applyFolderFilter()` shows/hides playlist cards based on selection
- Hard-coded test folders in dropdown: "🎵 Music (OL test)", "🎨 Art (RD test)"
- Modified `handleFolderSelect()` to apply filter after saving selection
- Modified `init()` to scrape playlists and apply filter on page load via `initializeFilterOnLoad()`
- Added `getFolderLabel()` handling for test folder IDs

#### Issues encountered
- Bug: Test folders showed "All Folders" in button label instead of folder name
  - Cause: `getFolderLabel()` didn't know about test folder IDs (not in storage)
  - Fix: Added explicit handling for `TEST_FOLDER_MUSIC` and `TEST_FOLDER_ART` constants

#### Testing (All 7 tests passed)
- [x] Select "All Playlists" → all playlist cards visible
- [x] Select "Music" → only OL-prefixed playlists visible
- [x] Select "Art" → only RD-prefixed playlists visible
- [x] Select "Unassigned" → only PL/FL/LL/WL-prefixed playlists visible
- [x] Switch between folders → visibility updates correctly
- [x] Reload with folder selected → filter applied automatically
- [x] Empty folder → no playlists visible

#### Lessons learned
- Test folders need explicit handling in all display functions, not just menu building
- Prefix-based filtering is effective for testing without specific IDs

#### Files changed
- Modified: `src/content/youtube.ts` (caching, filtering, test folders)
- Modified: `DEVPLAN.md` (Phase 4a specification and testing)

---

### [2026-01-13] Phase 3: Storage Integration

#### What was done
- Cleaned up `types.ts`: removed `unassignedPlaylists` from `StorageState`, added `selectedFolderId`
- Updated `storage.ts`:
  - Added `CreateFolderResult` type for typed error handling
  - Added `folderNameExists()` for case-insensitive duplicate checking
  - Modified `createFolder()` to validate and return success/error result
  - Added `getSelectedFolderId()` and `setSelectedFolderId()` for selection persistence
  - Updated `deleteFolder()` to clear selection if deleted folder was selected
- Rewrote dropdown in `youtube.ts`:
  - Imports storage layer and uses `folderStorage` singleton
  - Loads folders from storage on init, renders dynamically
  - Folders sorted alphabetically in dropdown menu
  - Selection persisted to storage and restored on page load
  - "New Folder" button triggers browser `prompt()`, validates, saves, auto-selects
  - Added special constants `FOLDER_ID_ALL` and `FOLDER_ID_UNASSIGNED`
  - Added helper functions: `buildMenuItems()`, `escapeHtml()`, `getFolderLabel()`, `handleFolderSelect()`, `handleNewFolder()`, `updateDropdownLabel()`, `refreshDropdownMenu()`

#### Decisions documented
- D-8: Folder display order - alphabetical
- D-9: New Folder UI - browser `prompt()` for MVP
- D-10: Folder selection persistence - yes, persist across reloads

#### Issues encountered
- None

#### Testing (All 8 tests passed 2026-01-14)
- [x] Dropdown shows "All Playlists", "Unassigned", "+ New Folder" on fresh install
- [x] Creating folder "Music" adds it to dropdown between separators
- [x] Creating folder "Art" appears before "Music" (alphabetical)
- [x] Folder persists after page reload
- [x] Selected folder persists after page reload
- [x] Duplicate folder name (case-insensitive) shows error alert
- [x] Empty folder name shows error alert
- [x] Clicking cancel on prompt does nothing

#### Lessons learned
- TypeScript's discriminated union pattern (`CreateFolderResult`) provides clean error handling
- Storing `selectedFolderId` separately from folders keeps concerns separated

#### Files changed
- Modified: `src/shared/types.ts` (removed `unassignedPlaylists`, added `selectedFolderId`)
- Modified: `src/shared/storage.ts` (added validation, selection methods)
- Modified: `src/content/youtube.ts` (dynamic dropdown, folder creation)
- Modified: `DEVPLAN.md` (Phase 3 detailed plan, decisions D-8/D-9/D-10)

---

## Upcoming

**Next**: Phase 5 - Organization Modal
- Create modal structure for playlist management
- Implement folder sidebar with counts
- Create playlist grid
- Add drag-and-drop or click-to-assign functionality
- Save/Cancel with confirmation

---

### [2026-01-14] Pre-Phase 5 Cleanup

#### What was done
- Removed `seedTestFolders()` function (75 lines of Phase 4b temporary testing code)
- Removed all verbose debug `console.log` statements throughout `youtube.ts`
- Kept essential Ctrl+Shift+Y debug hotkey (marked for Phase 6 cleanup)
- Updated README.md to remove completed TODO items

#### Issues encountered
- None

#### Lessons learned
- Keeping test code isolated in named functions makes cleanup straightforward

#### Files changed
- Modified: `src/content/youtube.ts` (removed ~100 lines of debug/test code)
- Modified: `README.md` (removed completed TODO items)

---

### [2026-01-15] Phase 5a: Modal Structure & Open/Close

#### What was done
- Added "Organize..." menu item to dropdown (after "+ New Folder")
- Created `src/content/modal.ts` with modal open/close logic
- Created `src/styles/modal.css` with YouTube-matching dark theme styles
- Modal shell: full-screen overlay, container (90vw×80vh), header with title and X close button
- Close mechanisms: X button, Escape key, click outside modal
- Updated manifest.json to include modal.css in content scripts
- Initialized Git repository and pushed to GitHub

#### Issues encountered
- Close button (X icon) initially not visible due to missing explicit SVG sizing
  - Fixed by adding `width: 40px; height: 40px` to button and `width: 24px; height: 24px` to SVG

#### Lessons learned
- SVGs in buttons need explicit sizing to be visible
- Modal uses `position: fixed` with high z-index (9999) to overlay YouTube

#### Files changed
- Added: `src/content/modal.ts`
- Added: `src/styles/modal.css`
- Added: `.gitignore`
- Modified: `src/content/youtube.ts` (import modal, add "Organize..." handler)
- Modified: `src/manifest.json` (add modal.css to content scripts)

---

### [2026-01-15] Phase 5b-5d: Modal Features

#### What was done
- Phase 5b: Folder sidebar with counts, selection, rename/delete icons on hover
- Phase 5c: Playlist grid with thumbnails and titles
- Phase 5d: Click-to-assign workflow (select playlist → click folder → assign)
- Added static tip in modal header: "Click a playlist, then click a folder to move it"
- Added playlist counts to dropdown menu items
- Added custom event sync between modal and dropdown (`ytcatalog-folders-changed`)

#### Issues encountered
- Dropdown counts showed zeros on first open
  - Fixed by calling `refreshDropdownMenu()` after playlists are cached
- Clicking on count span inside dropdown item didn't trigger action
  - Fixed by using `closest('.ytcatalog-dropdown-item')` in click handler

#### Files changed
- Modified: `src/content/modal.ts` (sidebar, grid, click-to-assign)
- Modified: `src/styles/modal.css` (sidebar, grid, selection styles)
- Modified: `src/content/youtube.ts` (dropdown counts, event sync)
- Modified: `src/styles/dropdown.css` (count styling)

---

### [2026-01-16] Bug Investigation: Stale Cache / Element Recycling

#### Problem observed
1. After using YouTube's sort button (Recently added/Alphabetically), our folder filter shows wrong playlists
2. After using YouTube's native filters (Playlists, Music, Owned/Saved), our counts change incorrectly

#### Investigation process
Hypothesis 1: YouTube replaces DOM elements when sorting
- Test: Saved element reference, sorted, checked `document.contains(element)`
- Result: `true` - element still in DOM
- Conclusion: YouTube is NOT replacing elements

Hypothesis 2: YouTube recycles DOM elements (same node, different content)
- Test: Saved element reference, captured playlist ID from class, sorted, re-read ID
- Result:
  - Before sort: `PLLmXZMqb_9sbNLM83NrM005vRQHw1yTKn`
  - After sort: `PLA_L1fYcgtfKt3-kn6yatPOSIP7feeYdV`
- Conclusion: **CONFIRMED** - YouTube reuses DOM nodes for different playlists

#### Root cause
YouTube recycles `<ytd-rich-item-renderer>` DOM elements when sorting/filtering. The same DOM node is reused to display a completely different playlist. Our cached `element→ID` mappings become invalid.

**Why filtering breaks:**
1. We cache: `{ id: "PLLmXZMqb...", element: <node> }`
2. YouTube sorts → `<node>` now displays playlist `PLA_L1fYcgtfKt...`
3. We try to hide `<node>` thinking it's `PLLmXZMqb...`
4. But we're actually hiding `PLA_L1fYcgtfKt...` (wrong playlist!)

#### Solution implemented
MutationObserver with debouncing:
1. Watch playlist container for DOM changes (`childList`, `attributes` on `class`)
2. Debounce (400ms) for YouTube to finish mutations
3. Skip if we're in scroll-to-load (our own mutations via `isScrollingToLoad` flag)
4. Clear playlist cache
5. Re-scrape playlists (fast, no scroll - just read current DOM)
6. Re-apply current folder filter
7. Update dropdown counts

#### Files changed
- Modified: `src/content/youtube.ts`
  - Added `MutationObserver` watching `#contents` for DOM changes
  - Added `handlePlaylistMutations()` with 400ms debounce
  - Added `startPlaylistObserver()` and `stopPlaylistObserver()`
  - Added `isScrollingToLoad` flag to prevent re-scrape during our own scroll
  - Updated `loadAndScrapeAllPlaylists()` to set/clear flag
  - Updated `initializeFilterOnLoad()` to start observer
  - Updated `init()` to stop observer when leaving playlists page

#### Status
✅ FIXED - All tests passed 2026-01-16

---

## Issue Tracker

| ID | Status | Description | Resolution |
|----|--------|-------------|------------|
| - | - | No issues logged yet | - |

---

## Performance Notes

*Reserved for performance observations and optimizations.*

---

## Browser Compatibility Notes

*Reserved for cross-browser testing results.*

| Feature | Chrome | Firefox | Notes |
|---------|--------|---------|-------|
| - | - | - | Testing not yet started |

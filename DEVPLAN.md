# YTCatalog - Development Plan

## Product Vision

YTCatalog is a browser extension that brings folder organization to YouTube playlists. Users can create custom folders, assign playlists to them, and quickly filter their playlist view - solving the problem of managing large numbers of YouTube playlists.

---

## Requirements

### Functional Requirements

1. **Folder Management**
   - Create, rename, and delete custom folders
   - Each playlist can belong to only one folder
   - "Unassigned" category for playlists not in any folder

2. **Quick Access Mode (Dropdown)**
   - Dropdown filter integrated into YouTube's playlist interface
   - Filter options: All Playlists, Unassigned, [Custom Folders]
   - Minimal visual impact on YouTube's native UI

3. **Organization Mode (Modal)**
   - Full-screen modal for managing playlists and folders
   - Drag-and-drop playlist organization
   - Folder sidebar with counts
   - Save/Cancel with unsaved changes confirmation

4. **Data Persistence**
   - Store folder structure in browser's local storage
   - Persist across browser sessions
   - Handle storage gracefully (no cloud sync in v1)

### Non-Functional Requirements

- Chrome Manifest V3 compliance
- Cross-browser compatibility (Chrome, Firefox)
- Match YouTube's visual design language
- Handle YouTube's SPA navigation
- TypeScript for type safety

---

## Architecture

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Type safety, better DX |
| Build | Webpack | Bundle TS, copy assets |
| Extension API | Manifest V3 | Required for modern extensions |
| Storage | chrome.storage.local | Persistent, extension-scoped |
| Styling | CSS (YouTube-matched) | Seamless integration |

### Data Model

```typescript
interface Folder {
  id: string;
  name: string;
  playlistIds: string[];
}

interface StorageState {
  folders: Record<string, Folder>;
}
```

**Key Design Principles:**

1. **Source of truth for playlists = YouTube DOM**
   - We do NOT cache playlist metadata (title, thumbnail)
   - Playlist info is read fresh from the page each time
   - Avoids sync issues when YouTube data changes

2. **Unassigned = computed, not stored**
   - "Unassigned" playlists = (all playlists on page) minus (playlists in any folder)
   - No separate `unassignedPlaylists` array needed

3. **Storage only holds folder→playlistID mappings**
   - Folders contain arrays of playlist IDs
   - Minimal storage footprint

4. **Scroll-to-load for complete playlist capture**
   - YouTube uses lazy loading / infinite scroll
   - Must trigger scroll to load all playlists before scraping
   - Essential for the extension to be useful with large playlist collections

### Project Structure

```
YTCatalog/
├── package.json
├── tsconfig.json
├── webpack.config.js
├── src/
│   ├── manifest.json
│   ├── background/service-worker.ts
│   ├── content/
│   │   ├── youtube.ts
│   │   ├── dropdown.ts
│   │   └── modal.ts
│   ├── shared/
│   │   ├── types.ts
│   │   └── storage.ts
│   └── styles/
│       ├── dropdown.css
│       └── modal.css
└── dist/
```

---

## Roadmap

### Phase 1: Basic Integration ✓
- [x] Set up development environment
- [x] Create project structure and config files
- [x] Implement basic extension that loads on YouTube
- [x] Detect playlist pages
- [x] Find UI injection point for dropdown
- [x] Create static dropdown UI matching YouTube's chip design

### Phase 2: Playlist Scraping ✓
- [x] Scroll-to-load: trigger scroll to load all playlists
- [x] Scrape playlist IDs and metadata from YouTube DOM
- [x] Identify stable selectors for playlist elements
- [x] Test with varying playlist counts (tested with 300+ playlists)

### Phase 3: Storage Integration ✓

**Goal**: Connect dropdown to Chrome Storage, enable folder creation, persist user selection.

**Scope**: Folder creation only. Rename/delete deferred to Phase 5 (modal). Playlist assignment deferred to Phase 5. Filtering deferred to Phase 4.

- [x] Remove `unassignedPlaylists` from types (computed in Phase 4)
- [x] Connect dropdown to storage layer
- [x] Load folders on init, populate dropdown dynamically (alphabetical order)
- [x] Implement "New Folder" creation (browser prompt → validate → save)
- [x] Persist selected folder across page reloads

#### Phase 3 Implementation Summary

- `types.ts`: Removed `unassignedPlaylists`, added `selectedFolderId`
- `storage.ts`: Added `CreateFolderResult` type, `folderNameExists()`, `getSelectedFolderId()`, `setSelectedFolderId()`
- `youtube.ts`: Dynamic dropdown rendering, folder creation with validation, selection persistence

#### Phase 3 Testing (All Passed 2026-01-14)
- [x] Dropdown shows "All Playlists", "Unassigned", "+ New Folder" on first load
- [x] Creating folder "Music" adds it to dropdown between separators
- [x] Creating folder "Art" appears before "Music" (alphabetical)
- [x] Folder persists after page reload
- [x] Selected folder persists after page reload
- [x] Creating duplicate folder name (case-insensitive) shows error alert
- [x] Empty folder name shows error alert
- [x] Clicking cancel on prompt does nothing

### Phase 4: Filtering Logic ✓

**Goal**: Filter playlist view based on selected folder; compute "unassigned" dynamically.

#### Phase 4a: Hard-coded Filtering ✓

**Scope**: Prove filtering/show/hide logic works with prefix-based test assignments. No real storage integration yet.

**Implementation approach**:
- Prefix-based test assignments: OL→Music, RD→Art, rest→Unassigned
- Scrape playlists once on page load, cache in memory for session
- Hard-code test folders in dropdown menu
- Apply filter on page load if folder persisted

**Tasks**:
- [x] Add `cachedPlaylists` variable and `ensurePlaylistsCached()` function
- [x] Add `getTestFolderIdForPlaylist(id)` function (prefix-based matching)
- [x] Add `applyFolderFilter(folderId)` function (show/hide logic)
- [x] Hard-code "Music" and "Art" test folders in `buildMenuItems()`
- [x] Modify `handleFolderSelect()` to call `applyFolderFilter()`
- [x] Modify `init()` to scrape + apply filter on page load

**Testing (All 7 tests passed 2026-01-14)**:
- [x] Select "All Playlists" → all playlist cards visible
- [x] Select "Music" → only OL-prefixed playlists visible
- [x] Select "Art" → only RD-prefixed playlists visible
- [x] Select "Unassigned" → only PL/FL/LL/WL-prefixed playlists visible
- [x] Switch between folders → visibility updates correctly each time
- [x] Select folder, reload page → filter applied automatically after reload
- [x] Select folder with no matching playlists → no playlists visible (empty state)

#### Phase 4b: Storage-based Filtering ✓

**Goal**: Replace hard-coded prefix logic with real storage-based lookup. Prove filtering works with data from storage.

**Scope**: Storage integration for filtering. Assignment UI deferred to Phase 5.

**Implementation approach**:
- Remove all Phase 4a hard-coded test logic
- Add `getFolderIdForPlaylist(playlistId, folders)` - looks up playlist in folder's `playlistIds` array
- Add `seedTestFolders()` - creates Music/Art folders and populates with playlist IDs from scraping
- Seed with SWAPPED assignments (opposite of Phase 4a to verify difference): OL→Art, RD→Music
- Handle deleted folder edge case: silent reset to "All Playlists" + refresh dropdown

**Tasks**:
- [x] Remove `getTestFolderIdForPlaylist()` function
- [x] Remove `TEST_FOLDER_MUSIC` and `TEST_FOLDER_ART` constants
- [x] Remove test folder hard-coding from `buildMenuItems()`
- [x] Remove test folder handling from `getFolderLabel()`
- [x] Add `getFolderIdForPlaylist(playlistId, folders)` - storage-based lookup
- [x] Add `seedTestFolders()` - creates Music/Art folders with OL→Art, RD→Music
- [x] Modify `applyFolderFilter()` to load folders from storage and use new lookup
- [x] Handle deleted folder: if selected folder doesn't exist, reset to All Playlists + refresh dropdown
- [x] Call `seedTestFolders()` on init

**Testing (All 8 tests passed 2026-01-14)**:
- [x] After seed: Music folder contains RD playlists (opposite of 4a)
- [x] After seed: Art folder contains OL playlists (opposite of 4a)
- [x] Select "Music" → only RD-prefixed playlists visible (swapped)
- [x] Select "Art" → only OL-prefixed playlists visible (swapped)
- [x] Select "Unassigned" → only PL/FL/LL/WL playlists visible
- [x] Select "All Playlists" → all playlists visible
- [x] Reload page → folders and assignments persist
- [x] Delete selected folder (via DevTools), reload → resets to All Playlists silently, folder removed from dropdown

**Note**: Deleted folders are recreated on next page load by `seedTestFolders()` - this is expected temporary behavior for Phase 4b testing. Will be removed in Phase 5.

### Phase 5: Organization Modal ✓

**Goal**: Full-screen modal for managing playlists and folders with click-to-assign workflow.

**Key Design Decisions**:
- Modal opens from "Organize..." menu item in dropdown (D-16)
- Click-to-assign workflow instead of drag-and-drop (D-17)
- Hover to reveal edit/delete icons on folder rows (D-18)
- Changes apply immediately, no Save/Cancel workflow (D-19)

#### Phase 5a: Modal Structure & Open/Close ✓

**Scope**: Basic modal shell that opens and closes.

**Tasks**:
- [x] Add "Organize..." menu item to dropdown (after "+ New Folder", with separator)
- [x] Create `src/content/modal.ts` for modal logic
- [x] Create `src/styles/modal.css` for modal styling
- [x] Create modal shell: full-screen overlay, container, header with title + close button
- [x] Wire "Organize..." click to open modal
- [x] Close modal: X button, Escape key, click outside overlay
- [x] Update webpack config if needed for new files

**Testing**:
- [x] Click "Organize..." in dropdown → modal opens
- [x] Click X button → modal closes
- [x] Press Escape → modal closes
- [x] Click outside modal container → modal closes
- [x] Modal has header "Organize Playlists" with close button

#### Phase 5b: Folder Sidebar ✓

**Scope**: Left sidebar showing folders with counts.

**Tasks**:
- [x] Add left sidebar (250px fixed width)
- [x] Show "Unassigned" at top with computed count
- [x] List user folders with playlist counts
- [x] Clicking folder selects/highlights it
- [x] "+ New Folder" button at bottom (reuse existing validation logic)
- [x] Style to match YouTube aesthetic

**Testing**:
- [x] Sidebar shows "Unassigned" with correct count
- [x] Sidebar shows user folders (Music, Art) with correct counts
- [x] Clicking folder highlights it
- [x] "+ New Folder" creates folder and adds to list
- [x] Folder validation works (empty name, duplicate name)

#### Phase 5c: Playlist Grid ✓

**Scope**: Right side showing playlists for selected folder.

**Tasks**:
- [x] Add right content area (flex grow)
- [x] Show playlist cards: thumbnail + title
- [x] Display playlists for currently selected folder
- [x] Update grid when selecting different folder in sidebar
- [x] Handle empty state (no playlists in folder)

**Testing**:
- [x] Selecting "Unassigned" shows unassigned playlists
- [x] Selecting "Music" shows Music folder playlists
- [x] Selecting "Art" shows Art folder playlists
- [x] Empty folder shows appropriate message
- [x] Playlist cards display thumbnail and title

#### Phase 5d: Click-to-Assign Playlists ✓

**Scope**: Assign playlists to folders via click workflow.

**Design Decisions**:
- Single-select only (one playlist at a time); bulk operations deferred to Phase 6
- Selected state: blue border + slight scale (YouTube-like style)
- After assignment: playlist disappears from current view (moved to different folder)
- Clicking "Unassigned" removes playlist from any folder
- Clicking same folder playlist is already in: deselects playlist (no-op)
- Clicking another playlist replaces selection

**Tasks**:
- [x] Click playlist card to select it (visual highlight)
- [x] Click folder in sidebar to move selected playlist to that folder
- [x] Apply change immediately to storage
- [x] Update counts in sidebar after assignment
- [x] Refresh grid to reflect change
- [x] Clear selection after assignment
- [x] Handle assigning to "Unassigned" (remove from current folder)
- [x] Handle clicking same folder (deselect, no-op)

**Testing - Selection**:
- [x] Click playlist card → card shows selected state (blue border)
- [x] Click same playlist again → deselects it (border removed)
- [x] Click different playlist → new one selected, previous deselected
- [x] Only one playlist can be selected at a time

**Testing - Assignment**:
- [x] Select playlist in Unassigned → click Music folder → playlist moves to Music
- [x] Sidebar counts update (Unassigned decreases, Music increases)
- [x] Playlist disappears from Unassigned grid
- [x] Switch to Music folder → assigned playlist appears there
- [x] Selection is cleared after assignment

**Testing - Unassign**:
- [x] Select playlist in Music folder → click Unassigned → playlist removed from Music
- [x] Sidebar counts update (Music decreases, Unassigned increases)
- [x] Playlist disappears from Music grid
- [x] Switch to Unassigned → playlist appears there

**Testing - Edge Cases**:
- [x] Click folder that playlist is already in → deselects playlist (no-op)
- [x] No playlist selected → clicking folder does nothing
- [x] Close modal → selection state is reset on next open

**Testing - Storage Verification**:
- [x] Assignment persists after closing and reopening modal
- [x] Assignment persists after page reload
- [x] Dropdown filtering reflects updated assignments

#### Phase 5e: Folder Rename ✓

**Scope**: Rename folders via hover-reveal UI.

**Tasks**:
- [x] Show edit icon on folder row hover
- [x] Click edit → prompt for new name (or inline edit)
- [x] Validate: non-empty, no duplicate name
- [x] Apply immediately to storage
- [x] Update sidebar display

**Testing**:
- [x] Hover folder → edit icon appears
- [x] Click edit → can enter new name
- [x] Empty name rejected with error
- [x] Duplicate name rejected with error
- [x] Valid rename updates storage and display
- [x] Dropdown shows renamed folder

#### Phase 5f: Folder Delete ✓

**Scope**: Delete folders via hover-reveal UI.

**Tasks**:
- [x] Show delete icon on folder row hover
- [x] Click delete → confirmation dialog
- [x] Playlists in deleted folder become unassigned
- [x] If deleted folder was selected in dropdown, reset to "All Playlists"
- [x] Apply immediately to storage
- [x] Update sidebar (remove folder, update Unassigned count)

**Testing**:
- [x] Hover folder → delete icon appears
- [x] Click delete → confirmation prompt
- [x] Cancel → no change
- [x] Confirm → folder deleted
- [x] Playlists from deleted folder appear in Unassigned
- [x] Sidebar counts update correctly
- [x] Dropdown no longer shows deleted folder

### Phase 6: Export/Import Folders ✓

**Goal**: Allow users to export their folder structure to a JSON file and import it back (for backup, transfer, or sharing).

**Key Design Decisions**:
- Simplified export format: name + playlistIds only, no internal IDs (D-20)
- Import merge strategy: Replace existing folders with same name (D-21)
- Playlist reassignment: Last folder wins, consistent with existing behavior (D-22)
- UI placement: Modal sidebar footer, below "+ New Folder" (D-23)
- File naming: `ytcatalog-folders-YYYY-MM-DD.json` (D-24)

#### Phase 6a: Export Functionality ✓

**Scope**: Export all folders to a downloadable JSON file.

**Export Format**:
```json
{
  "version": 1,
  "exportedAt": "2026-01-18T09:10:00Z",
  "folders": [
    { "name": "Music", "playlistIds": ["PL123", "PL456"] },
    { "name": "Art", "playlistIds": ["OL789"] }
  ]
}
```

**Tasks**:
- [x] Add `ExportData` type to types.ts
- [x] Add `buildExportData()` function to storage.ts
- [x] Add "Export" button to modal sidebar footer (modal.ts, modal.css)
- [x] Implement `handleExport()` - build JSON, trigger download
- [x] File named `ytcatalog-folders-YYYY-MM-DD.json`

**Testing**:
- [x] Click Export → downloads JSON file with correct name
- [x] Exported file contains correct JSON structure (version, exportedAt, folders)
- [x] Exported file contains all folders with correct names and playlistIds
- [ ] TODO: Export with no folders → downloads file with empty folders array

#### Phase 6b: Import Functionality ✓

**Scope**: Import folders from a JSON file, replacing existing folders with same name.

**Tasks**:
- [x] Add `ImportResult` type to types.ts (success/error with message)
- [x] Add `validateImportData()` function to storage.ts
- [x] Add `importFolders()` function to storage.ts (handles merge with replace strategy)
- [x] Add "Import" button to modal sidebar footer
- [x] Add hidden file input element for file picker
- [x] Implement `handleImport()` - read file, validate, import, refresh UI
- [x] Show success message with count of folders imported
- [x] Show error message for invalid JSON or wrong structure
- [x] Added `isStorageAvailable()` defensive check for extension context invalidation

**Import Behavior**:
- Existing folder with same name → replaced with imported data
- New folder name → created with new ID
- Playlist in multiple imported folders → last folder wins
- Playlist already assigned → reassigned to imported folder

**Testing - Happy Path**:
- [x] Click Import → file picker opens
- [x] Select valid file → folders imported, sidebar refreshes
- [ ] TODO: Import replaces existing folder with same name
- [x] Import adds new folders alongside existing ones
- [ ] TODO: Playlist reassignment works correctly
- [x] Success message shows count of imported folders

**Testing - Error Handling**:
- [x] Cancel file picker → no change, no error
- [ ] TODO: Invalid JSON → error message "Invalid file format"
- [ ] TODO: Missing version field → error message
- [ ] TODO: Missing folders array → error message
- [ ] TODO: Wrong file type (not .json) → error message or graceful handling

### Phase 7: Grid Layout Fix
- [ ] Investigate YouTube's CSS layout behavior with hidden items
- [ ] Implement solution for grid gaps when filtering
- [ ] Test across different playlist counts and screen sizes

### Phase 8: Firefox Compatibility
- [ ] Add webextension-polyfill or conditional API code
- [ ] Update manifest for Firefox compatibility
- [ ] Test all features in Firefox
- [ ] Document any browser-specific limitations

### YouTube DOM Selectors (Phase 2a Research)

Documented 2026-01-13 from live YouTube `/feed/playlists` page inspection.

**Scroll Container:**
```javascript
// Container holding all playlist cards - scroll this to load more
'#contents.style-scope.ytd-rich-grid-renderer'
// or simply
'ytd-rich-grid-renderer #contents'
```

**Playlist Card Selectors:**
```javascript
// Each playlist card
const PLAYLIST_CARD_SELECTOR = 'ytd-rich-item-renderer[lockup="true"]';

// Lockup div containing playlist ID in class attribute
const LOCKUP_WITH_ID_SELECTOR = 'div.yt-lockup-view-model[class*="content-id-"]';

// Extract playlist ID from class (e.g., "content-id-PLA_LlfYcgtfJo4C70xzl7FCttAjatJGRB")
const PLAYLIST_ID_REGEX = /content-id-([A-Za-z0-9_-]+)/;

// Fallback: extract from link href
const PLAYLIST_LINK_SELECTOR = 'a[href*="/playlist?list="]';

// Title (h3 has title attribute with full text)
const TITLE_SELECTOR = 'h3[title]';

// Thumbnail image
const THUMBNAIL_SELECTOR = '.ytThumbnailViewModelImage img';

// Video count badge
const VIDEO_COUNT_SELECTOR = '.yt-badge-shape__text';
```

**Key DOM Structure:**
```
ytd-rich-item-renderer[lockup="true"]
└── yt-lockup-view-model
    └── div.yt-lockup-view-model.content-id-{PLAYLIST_ID}
        ├── a.yt-lockup-view-model__content-image (thumbnail link)
        │   └── .ytThumbnailViewModelImage img
        └── .yt-lockup-view-model__metadata
            └── h3[title="{PLAYLIST_TITLE}"]
                └── .yt-lockup-metadata-view-model__title span (title text)
```

---

### Future Plans (Post-MVP)

#### Completed (was Phase 6)
- [x] **Stale cache due to YouTube element recycling** ✅ Fixed 2026-01-16
  - **Problem**: YouTube recycles DOM elements when sorting/filtering - the same `<ytd-rich-item-renderer>` node is reused to display different playlists. Our cached `element→ID` mappings became invalid.
  - **Solution**: MutationObserver with 400ms debouncing - watches playlist container for DOM changes, clears cache, re-scrapes playlists, re-applies current filter, updates counts.

#### Phase 6 Candidates

**Top Priority:**
- [ ] **Grid layout gaps when filtering**: YouTube's layout doesn't reflow properly when we hide playlists with `display: none`. Resize event doesn't help. May need to explore alternative approaches (CSS order, DOM manipulation, or accept as limitation)
- [ ] **Firefox support**: Use webextension-polyfill or conditional API code (`chrome.storage` → `browser.storage`)
- [ ] **Export/Import folders**: Download folders as JSON, import from JSON file (alternative to cloud sync)
- [ ] **Thumbnail loading for off-screen playlists**: YouTube lazy-loads images; off-screen playlist thumbnails don't load. Consider placeholder images, title-only cards, or alternative scraping approach

**Medium Priority:**
- [ ] **Bulk operations**: Multi-select playlists + bulk move to folder
- [ ] **Drag-and-drop**: Add drag-and-drop as alternative to click-to-assign

**Nice to Have:**
- [ ] **Save/Cancel workflow**: Add undo capability or Save/Cancel for modal changes
- [ ] **Remove/hide test hotkey**: Remove `Ctrl+Shift+Y` testing feature or hide behind debug flag
- [ ] **Import conflict dialog**: Add "Ask" dialog for import conflicts instead of auto-replace (see D-21)

#### Later
- Cloud sync functionality
- Folder nesting/hierarchy
- Playlist search within folders
- Keyboard shortcuts

---

## Decisions

```
D-1: Extension Manifest Version
Date: 2026-01-12
Status: Closed

Decision: Use Manifest V3
Rationale: Manifest V2 is deprecated; V3 is required for new Chrome extensions
Trade-offs: Some APIs work differently in V3, service workers instead of background pages
Revisit if: N/A - this is a hard requirement
```

```
D-2: Single Folder per Playlist
Date: 2026-01-12
Status: Closed

Decision: Each playlist can only belong to one folder
Rationale: Simpler data model, clearer UX, avoids complexity of multi-folder assignment
Trade-offs: Less flexible than tags/multi-folder approach
Revisit if: Users strongly request multi-folder support post-launch
```

```
D-3: Local Storage Only (v1)
Date: 2026-01-12
Status: Closed

Decision: No cloud sync in initial version
Rationale: MVP focus; cloud sync adds significant complexity (auth, conflict resolution)
Trade-offs: Data doesn't sync across devices/browsers
Revisit if: Core functionality is stable and users request sync
```

```
D-4: TypeScript + Webpack Build
Date: 2026-01-12
Status: Closed

Decision: Use TypeScript with Webpack for build process
Rationale: Type safety for complex data structures; Webpack handles bundling and asset copying
Trade-offs: Additional build step; more complex than vanilla JS
Revisit if: Build complexity becomes a bottleneck
```

```
D-5: Playlist Data Storage Approach
Date: 2026-01-13
Status: Closed

Decision: Do NOT cache playlist metadata; read from YouTube DOM each time
Rationale:
- Avoids sync issues when playlist titles/thumbnails change on YouTube
- Simpler storage model (only folder→playlistID mappings)
- Extension only operates on /feed/playlists page where DOM is always present
Trade-offs:
- Must scroll-to-load all playlists before scraping (YouTube uses lazy loading)
- Cannot display playlist info when not on the playlists page
Revisit if: Performance issues with large playlist counts, or need for offline access
```

```
D-6: Container Scoping for Playlist Scraping
Date: 2026-01-13
Status: Closed

Decision: Use `ytd-two-column-browse-results-renderer:not([page-subtype="home"])` to find playlists grid
Rationale:
- YouTube page has TWO ytd-rich-grid-renderer elements:
  1. One with page-subtype="home" for recommendations (at top of page)
  2. One without page-subtype for actual user playlists
- Using :not([page-subtype="home"]) excludes the recommendations grid
- Combined with playlist ID prefix filtering for reliability
Trade-offs:
- Depends on YouTube not changing their DOM structure
- If selector fails, falls back to document-wide search with ID filtering only
Revisit if: YouTube changes their DOM structure for the playlists page
```

```
D-7: Playlist ID Prefix Filtering
Date: 2026-01-13
Status: Closed

Decision: Include these playlist ID prefixes as "user playlists":
- PL - user-created playlists
- FL - favorites list
- LL - liked videos
- WL - watch later
- OL - official/album playlists (saved from YouTube Music)
- RD - radio/mix playlists (user may have saved these deliberately)

Exclude:
- UU - uploads from a channel (auto-generated, not user-curated)

Rationale:
- Prefix filtering reliably distinguishes playlists from individual videos
- OL and RD included because users may deliberately save albums and mixes
- UU excluded as these are auto-generated channel upload playlists
Trade-offs:
- May include some auto-generated mixes user didn't explicitly save
- If YouTube changes ID prefixes, filtering could break
Revisit if: Users report unwanted playlists appearing or wanted ones being excluded
```

```
D-8: Folder Display Order
Date: 2026-01-13
Status: Closed

Decision: Display folders in alphabetical order in the dropdown menu
Rationale: Predictable, consistent ordering makes folders easy to find
Trade-offs: New folders don't appear at top/bottom; must scan list
Revisit if: Users request custom ordering or creation-order preference
```

```
D-9: New Folder UI
Date: 2026-01-13
Status: Closed

Decision: Use browser's native `prompt()` dialog for folder name input
Rationale: Simplest implementation for MVP; no custom UI to build/style
Trade-offs: Basic appearance; no inline validation; modal disrupts flow
Revisit if: UX feedback requests inline input or styled dialog
```

```
D-10: Folder Selection Persistence
Date: 2026-01-13
Status: Closed

Decision: Persist the selected folder across page reloads
Rationale: Better UX; user doesn't lose context when navigating
Trade-offs: Slight complexity in storage; must handle deleted folder edge case
Revisit if: Users prefer always starting at "All Playlists"
```

```
D-11: Phase 4a Test Assignment Method
Date: 2026-01-14
Status: Closed

Decision: Use prefix-based test assignments (OL→Music, RD→Art, rest→Unassigned)
Rationale: Works with any user's library; no need to hard-code specific playlist IDs
Trade-offs: Test assignments don't reflect real user folder structure
Revisit if: N/A - this is temporary for Phase 4a testing only
```

```
D-12: Playlist Scraping Strategy
Date: 2026-01-14
Status: Closed

Decision: Scrape playlists once on page load, cache in memory for session
Rationale: Avoids slow scroll-to-load on every filter change; filtering uses cached data
Trade-offs: Data could become stale if user scrolls to load more playlists after initial scrape
Revisit if: Users report missing playlists when filtering
```

```
D-13: Phase 4a Test Folders in Dropdown
Date: 2026-01-14
Status: Closed

Decision: Hard-code "Music" and "Art" test folders in buildMenuItems()
Rationale: Simplest approach for testing; avoids creating real storage entries for test data
Trade-offs: Test folders mixed with real folders; code must be removed in Phase 4b
Revisit if: N/A - this is temporary for Phase 4a testing only
```

```
D-14: Phase 4b Test Data Seeding
Date: 2026-01-14
Status: Closed

Decision: Automated seeding via `seedTestFolders()` function with SWAPPED assignments (OL→Art, RD→Music)
Rationale:
- Automated seeding avoids manual DevTools editing
- Swapped assignments (opposite of Phase 4a) make it visually obvious that storage-based filtering is working differently
Trade-offs: Requires cleanup in Phase 5
Revisit if: N/A - this is temporary for Phase 4b testing only
```

```
D-15: Deleted Folder Handling
Date: 2026-01-14
Status: Closed

Decision: Silent reset to "All Playlists" if selected folder no longer exists
Rationale: Simple, non-intrusive handling; user will see all playlists and can select another folder
Trade-offs: No explicit notification that folder was deleted
Revisit if: Users report confusion about why selection changed
```

```
D-16: Modal Trigger
Date: 2026-01-14
Status: Closed

Decision: Add "Organize..." as a menu item in the existing dropdown
Rationale: Minimal UI footprint, reuses existing dropdown, discoverable
Trade-offs: Slightly hidden (requires opening dropdown)
Revisit if: Users have difficulty finding the organize feature
```

```
D-17: Playlist Assignment Method
Date: 2026-01-14
Status: Closed

Decision: Click-to-assign (click playlist, then click folder) instead of drag-and-drop
Rationale: Simpler to implement, works well on touchpads, less complex code
Trade-offs: Slightly more clicks than drag-and-drop
Revisit if: Users request drag-and-drop; could add as enhancement (see Phase 6 candidates)
```

```
D-18: Folder Edit/Delete UI
Date: 2026-01-14
Status: Closed

Decision: Hover to reveal edit/delete icons on folder rows
Rationale: More discoverable than right-click, works on touch/trackpad
Trade-offs: Icons add visual noise on hover
Revisit if: Touch device support needed (may need tap-to-reveal)
```

```
D-19: Modal Change Application
Date: 2026-01-14
Status: Closed

Decision: Apply changes immediately (no Save/Cancel workflow)
Rationale: Simpler UX, no risk of losing work, matches modern patterns
Trade-offs: No bulk "undo" if user makes mistakes
Revisit if: Users request undo capability (see Phase 6 candidates for Save/Cancel option)
```

```
D-20: Export Format
Date: 2026-01-18
Status: Closed

Decision: Simplified export format with name + playlistIds only, no internal IDs
Format:
{
  "version": 1,
  "exportedAt": "2026-01-18T09:10:00Z",
  "folders": [
    { "name": "Music", "playlistIds": ["PL123", "PL456"] }
  ]
}
Rationale:
- Internal folder IDs are implementation details, not meaningful to users
- Simpler format for manual editing if desired
- Avoids ID collision issues on import (new IDs generated)
Trade-offs: Cannot preserve folder identity across export/import cycles
Revisit if: Need to track folder identity for sync or versioning
```

```
D-21: Import Merge Strategy
Date: 2026-01-18
Status: Closed

Decision: Replace existing folders with same name when importing
Rationale:
- Simplest to implement for MVP
- Export/Import typically used for restore/transfer scenarios where replacement is expected
- Users can clear storage before importing for clean slate
Trade-offs: Existing folder content lost if same-name folder imported
Revisit if: Users request "Ask" dialog for conflict resolution (see Future Plans)
```

```
D-22: Import Playlist Reassignment
Date: 2026-01-18
Status: Closed

Decision: Last folder wins when playlist appears in multiple places
Rationale:
- Consistent with existing addPlaylistToFolder() behavior
- Single folder per playlist constraint (D-2) requires deterministic resolution
Trade-offs: If playlist in multiple imported folders, order matters
Revisit if: N/A - consistent with existing architecture
```

```
D-23: Export/Import UI Placement
Date: 2026-01-18
Status: Closed

Decision: Modal sidebar footer, below "+ New Folder" button
Rationale:
- Logically grouped with folder management actions
- Doesn't clutter main content area or modal header
- Visible without scrolling (sidebar footer is always visible)
Trade-offs: Slightly hidden; requires opening modal to access
Revisit if: Users request quick-access export from dropdown
```

```
D-24: Export File Naming
Date: 2026-01-18
Status: Closed

Decision: File named `ytcatalog-folders-YYYY-MM-DD.json`
Rationale:
- Descriptive and self-documenting
- Date suffix helps version multiple exports
- Example: ytcatalog-folders-2026-01-18.json
Trade-offs: None significant
Revisit if: N/A
```

---

## References

- [YTCatalog-doc.md](./YTCatalog-doc.md) - Full product specification
- [dev-setup-guide.md](./dev-setup-guide.md) - Detailed setup instructions
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

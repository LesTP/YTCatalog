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

### Phase 4: Filtering Logic ← CURRENT

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

### Phase 5: Organization Modal ← CURRENT

**Goal**: Full-screen modal for managing playlists and folders with click-to-assign workflow.

**Key Design Decisions**:
- Modal opens from "Organize..." menu item in dropdown (D-16)
- Click-to-assign workflow instead of drag-and-drop (D-17)
- Hover to reveal edit/delete icons on folder rows (D-18)
- Changes apply immediately, no Save/Cancel workflow (D-19)

#### Phase 5a: Modal Structure & Open/Close

**Scope**: Basic modal shell that opens and closes.

**Tasks**:
- [ ] Add "Organize..." menu item to dropdown (after "+ New Folder", with separator)
- [ ] Create `src/content/modal.ts` for modal logic
- [ ] Create `src/styles/modal.css` for modal styling
- [ ] Create modal shell: full-screen overlay, container, header with title + close button
- [ ] Wire "Organize..." click to open modal
- [ ] Close modal: X button, Escape key, click outside overlay
- [ ] Update webpack config if needed for new files

**Testing**:
- [ ] Click "Organize..." in dropdown → modal opens
- [ ] Click X button → modal closes
- [ ] Press Escape → modal closes
- [ ] Click outside modal container → modal closes
- [ ] Modal has header "Organize Playlists" with close button

#### Phase 5b: Folder Sidebar

**Scope**: Left sidebar showing folders with counts.

**Tasks**:
- [ ] Add left sidebar (250px fixed width)
- [ ] Show "Unassigned" at top with computed count
- [ ] List user folders with playlist counts
- [ ] Clicking folder selects/highlights it
- [ ] "+ New Folder" button at bottom (reuse existing validation logic)
- [ ] Style to match YouTube aesthetic

**Testing**:
- [ ] Sidebar shows "Unassigned" with correct count
- [ ] Sidebar shows user folders (Music, Art) with correct counts
- [ ] Clicking folder highlights it
- [ ] "+ New Folder" creates folder and adds to list
- [ ] Folder validation works (empty name, duplicate name)

#### Phase 5c: Playlist Grid

**Scope**: Right side showing playlists for selected folder.

**Tasks**:
- [ ] Add right content area (flex grow)
- [ ] Show playlist cards: thumbnail + title
- [ ] Display playlists for currently selected folder
- [ ] Update grid when selecting different folder in sidebar
- [ ] Handle empty state (no playlists in folder)

**Testing**:
- [ ] Selecting "Unassigned" shows unassigned playlists
- [ ] Selecting "Music" shows Music folder playlists
- [ ] Selecting "Art" shows Art folder playlists
- [ ] Empty folder shows appropriate message
- [ ] Playlist cards display thumbnail and title

#### Phase 5d: Click-to-Assign Playlists

**Scope**: Assign playlists to folders via click workflow.

**Tasks**:
- [ ] Click playlist card to select it (visual highlight)
- [ ] Click folder in sidebar to move selected playlist to that folder
- [ ] Apply change immediately to storage
- [ ] Update counts in sidebar after assignment
- [ ] Refresh grid to reflect change
- [ ] Visual feedback (brief highlight or animation)
- [ ] Handle assigning to "Unassigned" (remove from current folder)

**Testing**:
- [ ] Click playlist → playlist highlighted
- [ ] Click folder → playlist moves to folder
- [ ] Sidebar counts update correctly
- [ ] Playlist disappears from current view (moved to different folder)
- [ ] Storage updated immediately (verify via DevTools)
- [ ] Dropdown filtering still works after assignment

#### Phase 5e: Folder Rename

**Scope**: Rename folders via hover-reveal UI.

**Tasks**:
- [ ] Show edit icon on folder row hover
- [ ] Click edit → prompt for new name (or inline edit)
- [ ] Validate: non-empty, no duplicate name
- [ ] Apply immediately to storage
- [ ] Update sidebar display

**Testing**:
- [ ] Hover folder → edit icon appears
- [ ] Click edit → can enter new name
- [ ] Empty name rejected with error
- [ ] Duplicate name rejected with error
- [ ] Valid rename updates storage and display
- [ ] Dropdown shows renamed folder

#### Phase 5f: Folder Delete

**Scope**: Delete folders via hover-reveal UI.

**Tasks**:
- [ ] Show delete icon on folder row hover
- [ ] Click delete → confirmation dialog
- [ ] Playlists in deleted folder become unassigned
- [ ] If deleted folder was selected in dropdown, reset to "All Playlists"
- [ ] Apply immediately to storage
- [ ] Update sidebar (remove folder, update Unassigned count)

**Testing**:
- [ ] Hover folder → delete icon appears
- [ ] Click delete → confirmation prompt
- [ ] Cancel → no change
- [ ] Confirm → folder deleted
- [ ] Playlists from deleted folder appear in Unassigned
- [ ] Sidebar counts update correctly
- [ ] Dropdown no longer shows deleted folder

### Phase 6: Polish & Testing
- [ ] Error handling
- [ ] Edge cases
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Accessibility improvements

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

#### Phase 6 Candidates
- [ ] **Thumbnail loading for off-screen playlists**: YouTube lazy-loads images; off-screen playlist thumbnails don't load. Consider placeholder images, title-only cards, or alternative scraping approach
- [ ] **Bulk operations**: Multi-select playlists + bulk move to folder
- [ ] **Drag-and-drop**: Add drag-and-drop as alternative to click-to-assign
- [ ] **Save/Cancel workflow**: Add undo capability or Save/Cancel for modal changes
- [ ] **Firefox support**: Use webextension-polyfill or conditional API code (`chrome.storage` → `browser.storage`)
- [ ] **Export/Import folders**: Download folders as JSON, import from JSON file (alternative to cloud sync)
- [ ] **Remove/hide test hotkey**: Remove `Ctrl+Shift+Y` testing feature or hide behind debug flag

#### Later
- Cloud sync functionality
- Folder nesting/hierarchy
- Playlist search within folders
- Import/export folder structure
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

---

## References

- [YTCatalog-doc.md](./YTCatalog-doc.md) - Full product specification
- [dev-setup-guide.md](./dev-setup-guide.md) - Detailed setup instructions
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

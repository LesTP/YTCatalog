# YTCatalog
## YouTube Playlist Folder Organizer Extension

## I. Overview & Core Functionality

### Purpose
YTCatalog is a browser extension that adds folder organization capabilities to YouTube's playlist interface, allowing users to group playlists into custom folders for better organization and access.

### Core Features
1. **Folder Management**
   - Create custom folders
   - Assign playlists to folders
   - Single playlist can only belong to one folder
   - Special "Unassigned" category for playlists not in any folder

2. **Two Interaction Modes**
   - **Quick Access Mode**
     - Dropdown filter integrated into YouTube's existing interface
     - Allows quick filtering of playlists by folder
     - Minimal UI changes to YouTube's native interface
     - Options include:
       * All Playlists
       * Unassigned
       * Custom folders

   - **Organization Mode**
     - Full-screen modal interface for playlist management
     - Drag-and-drop functionality for organizing playlists
     - Folder creation/deletion/renaming
     - Bulk operations support

### Data Structure
```typescript
interface Folder {
  id: string;
  name: string;
  playlistIds: string[];
}

interface StorageState {
  folders: Record<string, Folder>;
  unassignedPlaylists: string[];
}
```

### Browser Support
- Chrome/Chromium-based browsers
- Firefox
- Uses WebExtensions API for cross-browser compatibility

### Limitations
- Works only on YouTube's playlist pages
- Requires browser extension permissions for YouTube domain
- Data stored locally in browser storage
- No cloud sync functionality in initial version

## II. User Interface

### A. Viewing Mode (Dropdown Filter)

#### Integration Point
- Appears next to YouTube's native "Recently added" filter dropdown
- Maintains YouTube's existing styling and UI patterns

#### Dropdown Structure
```
[Select Folder ▼]
All Playlists
Unassigned
─────────────   (separator)
Music
Tutorials
Cooking
```

#### Behavior
- Default selection shows all playlists
- Selecting a folder filters the view to show only playlists in that folder
- "Unassigned" shows playlists not belonging to any folder
- No impact on YouTube's native playlist functionality

### B. Organization Modal

#### Layout Components
1. **Header**
   - Title "Organize Playlists"
   - Close button
   - Save/Cancel actions

2. **Folder Sidebar (Left)**
   - Fixed width: 250px
   - Special "Unassigned" section at top
   - List of user-created folders
   - Folder count indicators
   - "+ New Folder" button at bottom
   - Visual separation between Unassigned and custom folders

3. **Playlist Grid (Right)**
   - YouTube-style playlist cards
   - Maintains familiar thumbnail + title format
   - Supports drag-and-drop
   - Shows playlists based on selected folder

#### Interactions
1. **Folder Management**
   - Click folder to view contents
   - Right-click for folder options (rename, delete)
   - "+ New Folder" creates new folder

2. **Playlist Organization**
   - Drag-and-drop playlists between folders
   - Visual feedback during drag operations
   - Playlist belongs to selected folder target

3. **Save/Cancel**
   - Changes not applied until Save
   - Cancel reverts to previous state
   - Confirmation prompt if unsaved changes

## III. Technical Implementation

### A. Core Technologies
- TypeScript for type safety and better development experience
- WebExtensions API for cross-browser compatibility
- Manifest V3 (required for modern extensions)

### B. Project Structure
```
YTCatalog/
├── package.json              # Dependencies and npm scripts
├── tsconfig.json             # TypeScript compiler configuration
├── webpack.config.js         # Build configuration
├── src/                      # Source files
│   ├── manifest.json         # Extension configuration
│   ├── background/
│   │   └── service-worker.ts # Background tasks, storage management
│   ├── content/
│   │   ├── youtube.ts        # YouTube page integration
│   │   ├── dropdown.ts       # Viewing mode implementation
│   │   └── modal.ts          # Organization modal implementation
│   ├── shared/
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── storage.ts        # Storage utilities
│   └── styles/
│       ├── dropdown.css      # Viewing mode styles
│       └── modal.css         # Modal styles
└── dist/                     # Compiled output (generated)
```

### C. Implementation Phases

#### 1. Environment Setup
```bash
# Initial setup
npm init
npm install --save-dev webpack typescript @types/chrome web-ext
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

#### 2. Basic Extension Setup
```javascript
// manifest.json
{
  "manifest_version": 3,
  "name": "YTCatalog",
  "version": "1.0.0",
  "description": "Organize YouTube playlists into folders",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "*://*.youtube.com/*"
  ],
  "content_scripts": [{
    "matches": ["*://*.youtube.com/*"],
    "js": ["content/youtube.js"],
    "css": ["styles/dropdown.css"],
    "run_at": "document_end"
  }],
  "background": {
    "service_worker": "background/service-worker.js"
  }
}
```

#### 3. YouTube Integration
```typescript
// youtube.ts
const PLAYLIST_PAGE_PATTERN = /youtube\.com\/playlist/;

function injectDropdown() {
  const filterContainer = document.querySelector('.playlist-filter-container');
  if (filterContainer) {
    // Inject our dropdown next to YouTube's filter
  }
}

// Initialize on navigation
if (PLAYLIST_PAGE_PATTERN.test(window.location.href)) {
  injectDropdown();
}
```

#### 4. Storage Implementation
```typescript
// storage.ts
class FolderStorage {
  async getFolders(): Promise<Record<string, Folder>> {
    const result = await chrome.storage.local.get('folders');
    return result.folders || {};
  }

  async saveFolders(folders: Record<string, Folder>): Promise<void> {
    await chrome.storage.local.set({ folders });
  }
}
```

### D. Testing Strategy

1. **Development Testing**
   - Load unpacked extension
   - Chrome DevTools for debugging
   - Watch mode for rapid development
   ```bash
   npm run watch     # Continuous build
   web-ext run       # Auto-reload extension
   ```

2. **Cross-browser Testing**
   - Test in Chrome and Firefox
   - Verify storage persistence
   - Check UI consistency

3. **Deployment Process**
   - Build production version
   - Package extension
   - Submit to stores
   ```bash
   npm run build
   web-ext build
   ```

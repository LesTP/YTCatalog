# Development Setup Guide
## Appendix to YTCatalog Extension Documentation

---

## IV. Development Environment Setup

### A. Prerequisites
- **Node.js**: JavaScript runtime for development tools (not used in the extension itself)
- **Visual Studio Code**: Recommended IDE with TypeScript support
- **Chrome Browser**: For testing the extension

### B. Technology Stack Overview

#### 1. Node.js & npm
- **Purpose**: Development environment and package management
- **Usage**:
  - Installing dependencies
  - Running build tools (webpack)
  - Managing development scripts
- **Note**: Node.js is only used during development, not in the final extension

#### 2. TypeScript
- **Purpose**: Adds static typing to JavaScript for better development experience
- **Benefits**:
  - Type safety and error detection before runtime
  - Better code completion and IntelliSense
  - Improved refactoring capabilities
  - Self-documenting code through type definitions
- **Compilation**: TypeScript code is compiled to JavaScript for browser execution

#### 3. WebExtensions API
Key APIs used in this extension:

**Storage API** - Persisting folder structure and user data
```typescript
chrome.storage.local.set({ folders: {...} });
chrome.storage.local.get('folders');
```

**Content Scripts** - Injecting UI into YouTube pages
```json
{
  "content_scripts": [{
    "matches": ["*://*.youtube.com/*"],
    "js": ["content/youtube.js"]
  }]
}
```

**Runtime API** - Communication between extension components
```typescript
chrome.runtime.sendMessage({ type: 'FOLDER_UPDATED', data: {...} });
```

**Permissions** - Required access levels
```json
{
  "permissions": ["storage"],
  "host_permissions": ["*://*.youtube.com/*"]
}
```

### C. Project Structure
```
YTCatalog/
├── package.json              # Dependencies and npm scripts
├── tsconfig.json            # TypeScript compiler configuration
├── webpack.config.js        # Build configuration
├── src/                     # Source files
│   ├── manifest.json        # Extension configuration
│   ├── background/
│   │   └── service-worker.ts    # Background processes
│   ├── content/
│   │   └── youtube.ts           # YouTube page integration
│   ├── shared/
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── storage.ts           # Storage utilities
│   └── styles/
│       └── dropdown.css         # UI styles
└── dist/                    # Compiled output (generated)
    └── [Built extension files ready for browser]
```

### D. Configuration Files

#### 1. package.json
```json
{
  "name": "YTCatalog",
  "version": "1.0.0",
  "description": "Browser extension for organizing YouTube playlists",
  "scripts": {
    "build": "webpack --mode development",
    "watch": "webpack --mode development --watch",
    "dev": "web-ext run --source-dir ./dist/"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "copy-webpack-plugin": "^12.0.2",
    "css-loader": "^6.10.0",
    "style-loader": "^3.3.4",
    "ts-loader": "^9.5.1",
    "typescript": "^5.3.3",
    "web-ext": "^7.11.0",
    "webpack": "^5.90.3",
    "webpack-cli": "^5.1.4"
  }
}
```

#### 2. tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3. webpack.config.js
```javascript
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    'content/youtube': './src/content/youtube.ts',
    'background/service-worker': './src/background/service-worker.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/styles', to: 'styles' }
      ]
    })
  ]
};
```

#### 4. src/manifest.json
```json
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
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*"],
      "js": ["content/youtube.js"],
      "css": ["styles/dropdown.css"],
      "run_at": "document_end"
    }
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  }
}
```

#### 5. src/shared/types.ts
```typescript
export interface Folder {
  id: string;
  name: string;
  playlistIds: string[];
}

export interface StorageState {
  folders: Record<string, Folder>;
  unassignedPlaylists: string[];
}
```

### E. Initial Setup Steps (Windows)

1. **Create project directory:**
   ```bash
   mkdir YTCatalog
   cd YTCatalog
   ```

2. **Open in VS Code:**
   ```bash
   code .
   ```

3. **Initialize Node.js project:**
   ```bash
   npm init -y
   ```

4. **Create folder structure:**
   ```bash
   mkdir src
   mkdir src\background
   mkdir src\content
   mkdir src\shared
   mkdir src\styles
   ```

5. **Install dependencies:**
   ```bash
   npm install --save-dev typescript webpack webpack-cli ts-loader @types/chrome copy-webpack-plugin css-loader style-loader web-ext
   ```

6. **Create all configuration files** as specified in Section IV.D above

7. **Create initial placeholder files:**
   - `src/content/youtube.ts`:
     ```typescript
     console.log('YTCatalog loaded');
     ```
   - `src/background/service-worker.ts`:
     ```typescript
     console.log('Background service worker loaded');
     ```
   - `src/styles/dropdown.css`:
     ```css
     .yt-playlist-folder-dropdown {
       display: inline-block;
       margin-left: 8px;
     }
     ```

### F. Development Workflow

#### Build Process Flow
```
TypeScript Source (.ts)
         ↓
    TypeScript Compiler
         ↓
    JavaScript (.js)
         ↓
      Webpack Bundler
         ↓
    dist/ folder (extension ready to load)
```

#### Development Commands

1. **One-time build:**
   ```bash
   npm run build
   ```
   - Compiles TypeScript to JavaScript
   - Bundles code with webpack
   - Copies manifest and assets to dist/
   - Use for: Initial testing

2. **Watch mode (recommended):**
   ```bash
   npm run watch
   ```
   - Automatically rebuilds on file changes
   - Keeps running in terminal
   - Use for: Active development

3. **Load extension in Chrome:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist/` folder
   - Extension is now active

4. **Testing changes:**
   - Make code changes in `src/`
   - Webpack rebuilds automatically (if watch mode is running)
   - Go to `chrome://extensions/`
   - Click refresh icon on your extension
   - Reload YouTube page to see changes

#### Using Devmate for Development
- Keep `npm run watch` running in VS Code terminal
- Use Devmate to request code changes and implementations
- Devmate can directly edit files in the project
- Webpack will automatically rebuild when files are saved
- Refresh extension in Chrome to see updates

### G. YouTube Page Integration Concepts

#### YouTube's Architecture
- Single-page application (SPA) using dynamic routing
- DOM structure updates without full page reloads
- Uses custom web components and Shadow DOM in some areas
- Frequent UI updates and redesigns require resilient selectors

#### Extension Integration Points
1. **Content Script Injection:**
   - Automatically runs when YouTube pages load
   - Has access to page DOM
   - Can inject UI elements
   - Shares execution context with page scripts

2. **DOM Manipulation Strategy:**
   - Identify stable anchor points in YouTube's UI
   - Insert dropdown next to existing filter controls
   - Match YouTube's styling patterns
   - Handle SPA navigation events

3. **Storage Integration:**
   - Save folder structure to browser storage
   - Load on page initialization
   - Sync updates across tabs
   - Persist between browser sessions

#### Key Technical Challenges
- **Dynamic selectors**: YouTube's DOM can change with updates
- **Timing issues**: Ensuring code runs after YouTube's UI loads
- **SPA navigation**: Detecting route changes without page reload
- **Style matching**: Maintaining consistency with YouTube's design

### H. Next Implementation Steps

1. **Phase 1: Basic Integration**
   - Detect YouTube playlist pages
   - Find injection point for dropdown
   - Create basic dropdown UI element
   - Test element appears on page

2. **Phase 2: Storage Layer**
   - Implement folder storage utilities
   - Create/read/update/delete folders
   - Handle data persistence

3. **Phase 3: UI Functionality**
   - Implement dropdown filtering
   - Add folder management modal
   - Implement drag-and-drop
   - Handle user interactions

4. **Phase 4: Polish**
   - Add error handling
   - Improve accessibility
   - Cross-browser testing
   - Performance optimization

---

## V. Development Notes & Context

### Current Status
- Environment setup documented and ready for implementation
- Configuration files specified and ready to create
- Core architecture and technology stack defined
- Ready to begin Phase 1: Basic Integration

### Implementation Priorities
1. Get basic extension loading and console logging working
2. Successfully inject a simple element into YouTube's DOM
3. Build out storage layer with proper TypeScript types
4. Implement dropdown UI and filtering logic
5. Add organization modal with full functionality

### Known Considerations for Future Discussion
- Robust selector strategy for YouTube's changing DOM
- Storage optimization for users with many playlists
- Accessibility features for modal and dropdown
- Error handling and edge cases
- Cross-browser compatibility testing

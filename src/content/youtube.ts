/**
 * YTCatalog Content Script
 * Runs on YouTube pages and handles UI injection
 */

import { folderStorage, CreateFolderResult } from '../shared/storage';
import { Folder } from '../shared/types';
import { openModal } from './modal';


// Pattern to detect the playlists library page (where all playlists are shown)
const PLAYLISTS_FEED_PATTERN = /youtube\.com\/feed\/playlists/;

// Special folder IDs for built-in options
const FOLDER_ID_ALL = '__all__';
const FOLDER_ID_UNASSIGNED = '__unassigned__';

// ============================================================================
// Playlist Caching
// ============================================================================

// Cached playlists for the session (scraped once on page load)
let cachedPlaylists: ScrapedPlaylist[] | null = null;

/**
 * Ensure playlists are scraped and cached.
 * Scrapes on first call, returns cached data on subsequent calls.
 */
async function ensurePlaylistsCached(): Promise<ScrapedPlaylist[]> {
  if (!cachedPlaylists) {
    cachedPlaylists = await loadAndScrapeAllPlaylists();
  }
  return cachedPlaylists;
}

/**
 * Clear the playlist cache (call when navigating away or when cache may be stale)
 */
function clearPlaylistCache(): void {
  cachedPlaylists = null;
}

// ============================================================================
// Phase 4b: Storage-based Folder Lookup
// ============================================================================

/**
 * Find which folder a playlist belongs to (from real storage).
 * Looks up the playlist ID in each folder's playlistIds array.
 *
 * @param playlistId - The playlist ID to look up
 * @param folders - The folders from storage
 * @returns folder ID if assigned, null if unassigned
 */
function getFolderIdForPlaylist(
  playlistId: string,
  folders: Record<string, Folder>
): string | null {
  for (const folder of Object.values(folders)) {
    if (folder.playlistIds.includes(playlistId)) {
      return folder.id;
    }
  }
  return null;
}

// ============================================================================
// Filtering Logic (Phase 4b - Storage-based)
// ============================================================================

/**
 * Apply folder filter to show/hide playlist cards.
 * Uses cached playlists and storage-based folder assignments.
 *
 * @param folderId - The folder to filter by (FOLDER_ID_ALL, FOLDER_ID_UNASSIGNED, or a folder ID)
 */
async function applyFolderFilter(folderId: string): Promise<void> {
  // Ensure playlists are cached
  const playlists = await ensurePlaylistsCached();

  // Load folders from storage
  const folders = await folderStorage.getFolders();

  // Handle deleted folder edge case: if selected folder doesn't exist, reset to All
  if (folderId !== FOLDER_ID_ALL && folderId !== FOLDER_ID_UNASSIGNED) {
    if (!folders[folderId]) {
      await folderStorage.setSelectedFolderId(null);
      folderId = FOLDER_ID_ALL;
      // Update dropdown label and menu (to remove deleted folder from list)
      await updateDropdownLabel();
      await refreshDropdownMenu();
    }
  }

  for (const playlist of playlists) {
    const playlistFolderId = getFolderIdForPlaylist(playlist.id, folders);
    let show = false;

    if (folderId === FOLDER_ID_ALL) {
      show = true;
    } else if (folderId === FOLDER_ID_UNASSIGNED) {
      show = playlistFolderId === null;
    } else {
      show = playlistFolderId === folderId;
    }

    playlist.element.style.display = show ? '' : 'none';
  }
}

// ============================================================================
// DOM Selectors (documented in DEVPLAN.md Phase 2a)
// ============================================================================

const SELECTORS = {
  // The playlists grid container - excludes home page recommendations which have page-subtype="home"
  // Line 254 has ytd-two-column-browse-results-renderer[page-subtype="home"] for recommendations
  // Line 947 has ytd-two-column-browse-results-renderer WITHOUT page-subtype for playlists
  playlistsGridContainer: 'ytd-two-column-browse-results-renderer:not([page-subtype="home"])',

  // Scroll container holding playlist cards inside the playlists grid
  scrollContainerInsideGrid: 'ytd-rich-grid-renderer #contents',

  // Each playlist card
  playlistCard: 'ytd-rich-item-renderer[lockup="true"]',

  // Lockup div containing playlist ID in class attribute
  lockupWithId: 'div.yt-lockup-view-model[class*="content-id-"]',

  // Fallback: link containing playlist ID
  playlistLink: 'a[href*="/playlist?list="]',

  // Title (h3 has title attribute)
  title: 'h3[title]',

  // Thumbnail image
  thumbnail: '.ytThumbnailViewModelImage img',

  // Video count badge
  videoCount: '.yt-badge-shape__text',
};

// Regex to extract playlist ID from class attribute
const PLAYLIST_ID_REGEX = /content-id-([A-Za-z0-9_-]+)/;

// ============================================================================
// Scroll-to-Load: Trigger scroll to load all playlists (YouTube lazy loads)
// ============================================================================

/**
 * Scroll the playlist container to load all playlists.
 * YouTube uses infinite scroll / lazy loading, so we must scroll to trigger loading.
 *
 * @returns Promise that resolves with the total number of playlists loaded
 */
async function scrollToLoadAllPlaylists(): Promise<number> {
  // First, find the playlists grid container (excludes home page recommendations)
  const gridContainer = document.querySelector(SELECTORS.playlistsGridContainer);
  if (!gridContainer) {
    return 0;
  }

  // Then find the #contents scroll container inside it
  const container = gridContainer.querySelector(SELECTORS.scrollContainerInsideGrid);
  if (!container) {
    return 0;
  }

  // Get initial count (only from within the playlists grid)
  let previousCount = gridContainer.querySelectorAll(SELECTORS.playlistCard).length;

  // Configuration
  const MAX_SCROLL_ATTEMPTS = 50;
  const SCROLL_DELAY_MS = 500;
  const STABLE_COUNT_THRESHOLD = 3;

  let stableCount = 0;
  let attempts = 0;

  while (attempts < MAX_SCROLL_ATTEMPTS && stableCount < STABLE_COUNT_THRESHOLD) {
    container.scrollTop = container.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(SCROLL_DELAY_MS);

    const currentCount = document.querySelectorAll(SELECTORS.playlistCard).length;

    if (currentCount === previousCount) {
      stableCount++;
    } else {
      stableCount = 0;
      previousCount = currentCount;
    }

    attempts++;
  }

  const finalCount = document.querySelectorAll(SELECTORS.playlistCard).length;

  // Scroll back to top for better UX
  window.scrollTo(0, 0);
  if (container.scrollTop !== undefined) {
    container.scrollTop = 0;
  }

  return finalCount;
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Playlist Scraping: Extract playlist data from the DOM
// ============================================================================

/**
 * Data structure for a scraped playlist
 */
interface ScrapedPlaylist {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoCount: string;
  element: HTMLElement; // Reference to the DOM element for filtering
}

/**
 * Extract playlist ID from a card element.
 * Tries multiple methods in order of reliability.
 * Returns null if this is not a user playlist (e.g., it's a video or auto-generated mix).
 */
function extractPlaylistId(card: Element): string | null {
  // Method 1: Extract from class attribute on lockup div
  const lockupDiv = card.querySelector(SELECTORS.lockupWithId);
  if (lockupDiv) {
    const classMatch = lockupDiv.className.match(PLAYLIST_ID_REGEX);
    if (classMatch && classMatch[1]) {
      const id = classMatch[1];
      // Only accept user-created playlists, not videos or auto-generated
      if (isUserPlaylistId(id)) {
        return id;
      }
    }
  }

  // Method 2: Extract from playlist link href (only matches /playlist?list= URLs)
  const playlistLink = card.querySelector(SELECTORS.playlistLink) as HTMLAnchorElement;
  if (playlistLink) {
    const href = playlistLink.getAttribute('href');
    if (href) {
      const listMatch = href.match(/[?&]list=([A-Za-z0-9_-]+)/);
      if (listMatch && listMatch[1] && isUserPlaylistId(listMatch[1])) {
        return listMatch[1];
      }
    }
  }

  return null;
}

/**
 * Check if an ID looks like a user-created playlist ID (not a video ID or auto-generated playlist).
 * Playlist IDs typically start with specific prefixes.
 * Video IDs are exactly 11 characters with no special prefix.
 */
function isUserPlaylistId(id: string): boolean {
  // User-created and saved playlist prefixes:
  // PL - user-created playlists
  // FL - favorites list
  // LL - liked videos
  // WL - watch later
  // OL - official/album playlists (saved from YouTube Music)
  // RD - radio/mix playlists (user may have saved these deliberately)
  const userPlaylistPrefixes = ['PL', 'FL', 'LL', 'WL', 'OL', 'RD'];

  // Auto-generated playlists to EXCLUDE:
  // UU - uploads from a channel (auto-generated, not user-curated)

  for (const prefix of userPlaylistPrefixes) {
    if (id.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Scrape all playlist data from the currently loaded DOM.
 * Should be called after scrollToLoadAllPlaylists() to ensure all playlists are loaded.
 * Filters by playlist ID prefix to exclude videos and auto-generated playlists.
 *
 * @returns Array of scraped playlist data
 */
function scrapeAllPlaylists(): ScrapedPlaylist[] {
  // Find the playlists grid container (excludes home page recommendations)
  const gridContainer = document.querySelector(SELECTORS.playlistsGridContainer);

  // Get all playlist cards from the grid container (or entire document as fallback)
  const searchRoot = gridContainer || document;
  const cards = searchRoot.querySelectorAll(SELECTORS.playlistCard);
  const playlists: ScrapedPlaylist[] = [];
  const seenIds = new Set<string>();

  cards.forEach((card) => {
    const id = extractPlaylistId(card);
    if (!id) {
      return;
    }

    if (seenIds.has(id)) {
      return;
    }
    seenIds.add(id);

    const titleEl = card.querySelector(SELECTORS.title) as HTMLElement;
    const title = titleEl?.getAttribute('title') || titleEl?.textContent || 'Unknown Playlist';

    const thumbnailEl = card.querySelector(SELECTORS.thumbnail) as HTMLImageElement;
    const thumbnailUrl = thumbnailEl?.src || '';

    const videoCountEl = card.querySelector(SELECTORS.videoCount);
    const videoCount = videoCountEl?.textContent || '';

    playlists.push({
      id,
      title: title.trim(),
      thumbnailUrl,
      videoCount: videoCount.trim(),
      element: card as HTMLElement,
    });
  });

  return playlists;
}

/**
 * Main function to load and scrape all playlists.
 * Combines scroll-to-load and scraping into one operation.
 *
 * @returns Promise that resolves with all scraped playlists
 */
async function loadAndScrapeAllPlaylists(): Promise<ScrapedPlaylist[]> {
  // First, scroll to load all playlists
  await scrollToLoadAllPlaylists();

  // Then scrape them
  return scrapeAllPlaylists();
}

// Track if we've already injected the dropdown
let dropdownInjected = false;

// Store reference to the dropdown for updates
let dropdownElement: HTMLElement | null = null;

/**
 * Check if current page is the YouTube playlists library
 */
function isPlaylistsLibraryPage(): boolean {
  return PLAYLISTS_FEED_PATTERN.test(window.location.href);
}

/**
 * Find the chip bar where we'll inject our dropdown
 */
function findChipBar(): Element | null {
  // The chip-bar-view-model contains the filter chips like "Recently added", "Playlists", etc.
  return document.querySelector('chip-bar-view-model.ytChipBarViewModelHost');
}

/**
 * Get the display label for a folder selection
 */
function getFolderLabel(folderId: string | null, folders: Record<string, Folder>): string {
  if (!folderId || folderId === FOLDER_ID_ALL) {
    return '📁 All Folders';
  }
  if (folderId === FOLDER_ID_UNASSIGNED) {
    return '📁 Unassigned';
  }
  const folder = folders[folderId];
  return folder ? `📁 ${folder.name}` : '📁 All Folders';
}

/**
 * Build the dropdown menu HTML from folders
 */
function buildMenuItems(folders: Record<string, Folder>, selectedId: string | null): string {
  // Sort folders alphabetically by name
  const sortedFolders = Object.values(folders).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  // Build menu items
  let html = '';

  // "All Playlists" option
  const allActive = !selectedId || selectedId === FOLDER_ID_ALL ? 'active' : '';
  html += `<button class="ytcatalog-dropdown-item ${allActive}" data-folder="${FOLDER_ID_ALL}">All Playlists</button>`;

  // "Unassigned" option
  const unassignedActive = selectedId === FOLDER_ID_UNASSIGNED ? 'active' : '';
  html += `<button class="ytcatalog-dropdown-item ${unassignedActive}" data-folder="${FOLDER_ID_UNASSIGNED}">Unassigned</button>`;

  // User folders (from storage)
  if (sortedFolders.length > 0) {
    html += '<div class="ytcatalog-dropdown-separator"></div>';

    for (const folder of sortedFolders) {
      const active = selectedId === folder.id ? 'active' : '';
      html += `<button class="ytcatalog-dropdown-item ${active}" data-folder="${folder.id}">${escapeHtml(folder.name)}</button>`;
    }
  }

  // Separator before "New Folder"
  html += '<div class="ytcatalog-dropdown-separator"></div>';
  html += '<button class="ytcatalog-dropdown-item ytcatalog-new-folder" data-action="new-folder">+ New Folder</button>';
  html += '<button class="ytcatalog-dropdown-item ytcatalog-organize" data-action="organize">Organize...</button>';

  return html;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle folder selection from dropdown
 */
async function handleFolderSelect(folderId: string): Promise<void> {
  // Save selection to storage
  if (folderId === FOLDER_ID_ALL) {
    await folderStorage.setSelectedFolderId(null);
  } else {
    await folderStorage.setSelectedFolderId(folderId);
  }

  // Update the dropdown label
  await updateDropdownLabel();

  // Apply the folder filter to show/hide playlists
  await applyFolderFilter(folderId);
}

/**
 * Handle "New Folder" action
 */
async function handleNewFolder(): Promise<void> {
  const name = prompt('Enter folder name:');

  if (name === null) {
    return;
  }

  // Create the folder
  const result: CreateFolderResult = await folderStorage.createFolder(name);

  if (!result.success) {
    if (result.error === 'empty_name') {
      alert('Folder name cannot be empty');
    } else if (result.error === 'duplicate_name') {
      alert('A folder with this name already exists');
    }
    return;
  }

  // Auto-select the new folder
  await folderStorage.setSelectedFolderId(result.folder.id);

  // Refresh the dropdown menu
  await refreshDropdownMenu();

  // Update the label
  await updateDropdownLabel();
}

/**
 * Update the dropdown button label based on current selection
 */
async function updateDropdownLabel(): Promise<void> {
  if (!dropdownElement) return;

  const label = dropdownElement.querySelector('.ytcatalog-chip-label');
  if (!label) return;

  const folders = await folderStorage.getFolders();
  const selectedId = await folderStorage.getSelectedFolderId();

  label.textContent = getFolderLabel(selectedId, folders);
}

/**
 * Refresh the dropdown menu items
 */
async function refreshDropdownMenu(): Promise<void> {
  if (!dropdownElement) return;

  const menu = dropdownElement.querySelector('.ytcatalog-dropdown-menu');
  if (!menu) return;

  const folders = await folderStorage.getFolders();
  const selectedId = await folderStorage.getSelectedFolderId();

  menu.innerHTML = buildMenuItems(folders, selectedId);
}

/**
 * Create the YTCatalog dropdown element matching YouTube's native chip design
 */
async function createDropdown(): Promise<HTMLElement> {
  // Load folders and selection from storage
  const folders = await folderStorage.getFolders();
  const selectedId = await folderStorage.getSelectedFolderId();

  // Create wrapper div matching YouTube's chip wrapper structure
  const wrapper = document.createElement('div');
  wrapper.className = 'ytChipBarViewModelChipWrapper ytcatalog-dropdown-wrapper';

  // Create our dropdown container
  const dropdown = document.createElement('div');
  dropdown.className = 'ytcatalog-dropdown';
  dropdown.id = 'ytcatalog-folder-dropdown';

  // Create the dropdown button matching YouTube's chip structure
  const button = document.createElement('button');
  button.className = 'ytChipShapeButtonReset ytcatalog-chip-button';
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-selected', 'false');
  button.innerHTML = `
    <div class="ytChipShapeChip ytChipShapeInactive ytChipShapeEndIconPadding ytcatalog-chip">
      <span class="ytcatalog-chip-label">${getFolderLabel(selectedId, folders)}</span>
      <span class="ytIconWrapperHost ytChipShapeIconEnd">
        <span class="yt-icon-shape ytSpecIconShapeHost">
          <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;">
              <path d="M18.707 8.793a1 1 0 00-1.414 0L12 14.086 6.707 8.793a1 1 0 10-1.414 1.414L12 16.914l6.707-6.707a1 1 0 000-1.414Z"></path>
            </svg>
          </div>
        </span>
      </span>
      <yt-touch-feedback-shape aria-hidden="true" class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response">
        <div class="yt-spec-touch-feedback-shape__stroke" style="border-radius: 8px;"></div>
        <div class="yt-spec-touch-feedback-shape__fill" style="border-radius: 8px;"></div>
      </yt-touch-feedback-shape>
    </div>
  `;

  // Create the dropdown menu
  const menu = document.createElement('div');
  menu.className = 'ytcatalog-dropdown-menu';
  menu.innerHTML = buildMenuItems(folders, selectedId);

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');

    if (dropdown.classList.contains('open')) {
      const rect = button.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${rect.left}px`;
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  // Handle menu clicks
  menu.addEventListener('click', async (e) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;

    if (!target.classList.contains('ytcatalog-dropdown-item')) {
      return;
    }

    // Handle "New Folder" action
    if (target.dataset.action === 'new-folder') {
      dropdown.classList.remove('open');
      await handleNewFolder();
      return;
    }

    // Handle "Organize..." action
    if (target.dataset.action === 'organize') {
      dropdown.classList.remove('open');
      openModal();
      return;
    }

    // Handle folder selection
    const folderId = target.dataset.folder;
    if (folderId) {
      // Update active state in menu
      menu.querySelectorAll('.ytcatalog-dropdown-item').forEach((item) => {
        item.classList.remove('active');
      });
      target.classList.add('active');

      dropdown.classList.remove('open');
      await handleFolderSelect(folderId);
    }
  });

  dropdown.appendChild(button);
  dropdown.appendChild(menu);
  wrapper.appendChild(dropdown);

  // Store reference for later updates
  dropdownElement = dropdown;

  return wrapper;
}

/**
 * Inject the dropdown into the chip bar
 */
async function injectDropdown(): Promise<void> {
  if (dropdownInjected || document.getElementById('ytcatalog-folder-dropdown')) {
    return;
  }

  const chipBar = findChipBar();
  if (!chipBar) {
    return;
  }

  const dropdown = await createDropdown();
  chipBar.insertBefore(dropdown, chipBar.firstChild);
  dropdownInjected = true;
}

/**
 * Initialize YTCatalog on the page
 */
async function init(): Promise<void> {
  if (isPlaylistsLibraryPage()) {
    // Reset injection flag and clear cache when navigating
    dropdownInjected = false;
    clearPlaylistCache();

    // Wait for YouTube's dynamic content to load, then inject
    setTimeout(async () => {
      await injectDropdown();

      // Retry a few times in case the chip bar loads slowly
      if (!dropdownInjected) {
        setTimeout(injectDropdown, 1000);
      }
      if (!dropdownInjected) {
        setTimeout(injectDropdown, 2000);
      }

      // After dropdown is injected, scrape playlists and apply filter if one is selected
      if (dropdownInjected) {
        await initializeFilterOnLoad();
      }
    }, 500);
  }
}

/**
 * Initialize filtering on page load.
 * Applies the persisted folder filter.
 */
async function initializeFilterOnLoad(): Promise<void> {
  const selectedId = await folderStorage.getSelectedFolderId();
  const folderId = selectedId || FOLDER_ID_ALL;
  await applyFolderFilter(folderId);
}

function observeNavigation(): void {
  document.addEventListener('yt-navigate-finish', () => {
    init();
  });
}

// Initialize on page load
init();
observeNavigation();

// Listen for folder changes from modal
document.addEventListener('ytcatalog-folders-changed', async () => {
  await refreshDropdownMenu();
  await updateDropdownLabel();
});

// ============================================================================
// Testing helper: Press Ctrl+Shift+Y to trigger test
// Remove this in production
// ============================================================================

// Debug testing helper (Ctrl+Shift+Y)
// TODO: Remove or hide behind debug flag in Phase 6
document.addEventListener('keydown', async (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'Y') {
    console.log('YTCatalog: Test triggered');
    const playlists = await loadAndScrapeAllPlaylists();
    console.log(`YTCatalog: Found ${playlists.length} playlists`);
    playlists.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title} (ID: ${p.id})`);
    });
  }
});

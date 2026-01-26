/**
 * YTCatalog Organization Modal
 * Full-screen modal for managing playlists and folders
 */

import { folderStorage } from '../shared/storage';
import { Folder, ExportData } from '../shared/types';

// ============================================================================
// Types
// ============================================================================

interface PlaylistInfo {
  id: string;
  title: string;
  channelName: string; // Channel name or "Your playlist" for own playlists
  videoCount: string;  // e.g., "42 videos" or "Playlist"
}

// ============================================================================
// Modal State
// ============================================================================

let modalElement: HTMLElement | null = null;
let isModalOpen = false;
let selectedFolderId: string | null = null; // null = Unassigned (folder being viewed)
let selectedPlaylistId: string | null = null; // Playlist selected for assignment
let cachedFolders: Record<string, Folder> = {};
let cachedPlaylists: PlaylistInfo[] = [];

// ============================================================================
// Playlist Scraping (simplified for modal)
// ============================================================================

/**
 * Scrape playlist info from the DOM for the modal.
 * Extracts id, title, channel name, and video count.
 */
function scrapePlaylistsForModal(): PlaylistInfo[] {
  const gridContainer = document.querySelector('ytd-two-column-browse-results-renderer:not([page-subtype="home"])');
  const searchRoot = gridContainer || document;
  const cards = searchRoot.querySelectorAll('ytd-rich-item-renderer[lockup="true"]');
  const playlists: PlaylistInfo[] = [];
  const seenIds = new Set<string>();

  cards.forEach((card) => {
    // Extract playlist ID
    const lockupDiv = card.querySelector('div.yt-lockup-view-model[class*="content-id-"]');
    let id: string | null = null;

    if (lockupDiv) {
      const classMatch = lockupDiv.className.match(/content-id-([A-Za-z0-9_-]+)/);
      if (classMatch && classMatch[1]) {
        id = classMatch[1];
      }
    }

    if (!id) {
      const playlistLink = card.querySelector('a[href*="/playlist?list="]') as HTMLAnchorElement;
      if (playlistLink) {
        const href = playlistLink.getAttribute('href');
        if (href) {
          const listMatch = href.match(/[?&]list=([A-Za-z0-9_-]+)/);
          if (listMatch && listMatch[1]) {
            id = listMatch[1];
          }
        }
      }
    }

    if (!id) return;

    // Filter to user playlists only
    const userPrefixes = ['PL', 'FL', 'LL', 'WL', 'OL', 'RD'];
    if (!userPrefixes.some(prefix => id!.startsWith(prefix))) return;

    if (seenIds.has(id)) return;
    seenIds.add(id);

    // Extract title
    const titleEl = card.querySelector('h3[title]') as HTMLElement;
    const title = titleEl?.getAttribute('title') || titleEl?.textContent || 'Unknown Playlist';

    // Extract video count (e.g., "42 videos")
    const videoCountEl = card.querySelector('.yt-badge-shape__text');
    const videoCount = videoCountEl?.textContent?.trim() || 'Playlist';

    // Extract channel name from links with /@username pattern
    // Only present for saved playlists from other channels
    const channelLink = card.querySelector('a[href*="/@"]') as HTMLAnchorElement;
    let channelName = 'Your playlist';
    if (channelLink) {
      const channelText = channelLink.textContent?.trim();
      // Filter out generic links like "Playlist" that also have /@ href
      if (channelText && channelText !== 'Playlist' && channelText !== 'View full playlist') {
        channelName = channelText;
      }
    }

    playlists.push({
      id,
      title: title.trim(),
      channelName,
      videoCount,
    });
  });

  return playlists;
}

// ============================================================================
// Folder Helpers
// ============================================================================

/**
 * Get the count of playlists in a folder
 */
function getFolderPlaylistCount(folderId: string | null): number {
  if (folderId === null) {
    // Unassigned: playlists not in any folder
    const assignedIds = new Set<string>();
    for (const folder of Object.values(cachedFolders)) {
      for (const id of folder.playlistIds) {
        assignedIds.add(id);
      }
    }
    return cachedPlaylists.filter(p => !assignedIds.has(p.id)).length;
  }

  const folder = cachedFolders[folderId];
  if (!folder) return 0;

  // Count only playlists that exist in the current page
  const playlistIds = new Set(cachedPlaylists.map(p => p.id));
  return folder.playlistIds.filter(id => playlistIds.has(id)).length;
}

/**
 * Get playlists for a folder
 */
function getPlaylistsForFolder(folderId: string | null): PlaylistInfo[] {
  if (folderId === null) {
    // Unassigned: playlists not in any folder
    const assignedIds = new Set<string>();
    for (const folder of Object.values(cachedFolders)) {
      for (const id of folder.playlistIds) {
        assignedIds.add(id);
      }
    }
    return cachedPlaylists.filter(p => !assignedIds.has(p.id));
  }

  const folder = cachedFolders[folderId];
  if (!folder) return [];

  const folderPlaylistIds = new Set(folder.playlistIds);
  return cachedPlaylists.filter(p => folderPlaylistIds.has(p.id));
}

// ============================================================================
// Sidebar Building
// ============================================================================

/**
 * Build the folder sidebar HTML
 */
function buildSidebarHTML(): string {
  const sortedFolders = Object.values(cachedFolders).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  const unassignedCount = getFolderPlaylistCount(null);
  const unassignedActive = selectedFolderId === null ? 'active' : '';

  let html = `
    <div class="ytcatalog-sidebar-section">
      <button class="ytcatalog-sidebar-item ${unassignedActive}" data-folder-id="__unassigned__">
        <span class="ytcatalog-sidebar-item-name">Unassigned</span>
        <span class="ytcatalog-sidebar-item-count">${unassignedCount}</span>
      </button>
    </div>
    <div class="ytcatalog-sidebar-divider"></div>
    <div class="ytcatalog-sidebar-section ytcatalog-sidebar-folders">
  `;

  for (const folder of sortedFolders) {
    const count = getFolderPlaylistCount(folder.id);
    const active = selectedFolderId === folder.id ? 'active' : '';
    html += `
      <div class="ytcatalog-sidebar-item-wrapper" data-folder-id="${folder.id}">
        <button class="ytcatalog-sidebar-item ${active}" data-folder-id="${folder.id}">
          <span class="ytcatalog-sidebar-item-name">${escapeHtml(folder.name)}</span>
          <span class="ytcatalog-sidebar-item-count">${count}</span>
        </button>
        <div class="ytcatalog-sidebar-item-actions">
          <button class="ytcatalog-sidebar-action ytcatalog-rename-folder" data-folder-id="${folder.id}" title="Rename">
            <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button class="ytcatalog-sidebar-action ytcatalog-delete-folder" data-folder-id="${folder.id}" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  html += `
    </div>
    <div class="ytcatalog-sidebar-footer">
      <button class="ytcatalog-sidebar-new-folder">+ New Folder</button>
      <div class="ytcatalog-sidebar-actions">
        <button class="ytcatalog-sidebar-export">Export</button>
        <button class="ytcatalog-sidebar-import">Import</button>
      </div>
    </div>
  `;

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
 * Render the sidebar
 */
function renderSidebar(): void {
  if (!modalElement) return;

  const sidebar = modalElement.querySelector('.ytcatalog-modal-sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = buildSidebarHTML();
  attachSidebarEventListeners();
}

/**
 * Get the current folder ID for a playlist
 */
function getCurrentFolderForPlaylist(playlistId: string): string | null {
  for (const folder of Object.values(cachedFolders)) {
    if (folder.playlistIds.includes(playlistId)) {
      return folder.id;
    }
  }
  return null;
}

/**
 * Assign a playlist to a folder (or unassign if folderId is null)
 */
async function assignPlaylistToFolder(playlistId: string, targetFolderId: string | null): Promise<void> {
  if (targetFolderId === null) {
    // Remove from any folder (unassign)
    await folderStorage.removePlaylistFromFolder(playlistId);
  } else {
    // Add to target folder (removes from previous folder automatically)
    await folderStorage.addPlaylistToFolder(targetFolderId, playlistId);
  }

  // Refresh cached folders
  cachedFolders = await folderStorage.getFolders();
}

/**
 * Attach event listeners to sidebar elements
 */
function attachSidebarEventListeners(): void {
  if (!modalElement) return;

  const sidebar = modalElement.querySelector('.ytcatalog-modal-sidebar');
  if (!sidebar) return;

  // Folder selection / assignment
  sidebar.querySelectorAll('.ytcatalog-sidebar-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const folderId = (item as HTMLElement).dataset.folderId;
      const targetFolderId = folderId === '__unassigned__' ? null : folderId;

      // If a playlist is selected, handle assignment
      if (selectedPlaylistId) {
        const currentFolder = getCurrentFolderForPlaylist(selectedPlaylistId);

        // If clicking the same folder the playlist is in, just deselect
        if (currentFolder === targetFolderId) {
          selectedPlaylistId = null;
          updatePlaylistSelectionUI();
          return;
        }

        // Assign to the clicked folder
        await assignPlaylistToFolder(selectedPlaylistId, targetFolderId ?? null);

        // Clear selection
        selectedPlaylistId = null;

        // Refresh UI
        renderSidebar();
        renderContent();
        return;
      }

      // No playlist selected - just navigate to folder
      if (folderId === '__unassigned__') {
        selectedFolderId = null;
      } else if (folderId) {
        selectedFolderId = folderId;
      }
      renderSidebar();
      renderContent();
    });
  });

  // New folder button
  const newFolderBtn = sidebar.querySelector('.ytcatalog-sidebar-new-folder');
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleNewFolderInModal();
    });
  }

  // Rename buttons
  sidebar.querySelectorAll('.ytcatalog-rename-folder').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const folderId = (btn as HTMLElement).dataset.folderId;
      if (folderId) {
        await handleRenameFolderInModal(folderId);
      }
    });
  });

  // Delete buttons
  sidebar.querySelectorAll('.ytcatalog-delete-folder').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const folderId = (btn as HTMLElement).dataset.folderId;
      if (folderId) {
        await handleDeleteFolderInModal(folderId);
      }
    });
  });

  // Export button
  const exportBtn = sidebar.querySelector('.ytcatalog-sidebar-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleExport();
    });
  }

  // Import button
  const importBtn = sidebar.querySelector('.ytcatalog-sidebar-import');
  if (importBtn) {
    importBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleImport();
    });
  }
}

/**
 * Handle new folder creation in modal
 */
async function handleNewFolderInModal(): Promise<void> {
  const name = prompt('Enter folder name:');
  if (name === null) return;

  const result = await folderStorage.createFolder(name);

  if (!result.success) {
    if (result.error === 'empty_name') {
      alert('Folder name cannot be empty');
    } else if (result.error === 'duplicate_name') {
      alert('A folder with this name already exists');
    }
    return;
  }

  // Refresh folders and re-render
  cachedFolders = await folderStorage.getFolders();
  selectedFolderId = result.folder.id;
  renderSidebar();
  renderContent();
}

/**
 * Handle folder rename in modal (Phase 5e placeholder)
 */
async function handleRenameFolderInModal(folderId: string): Promise<void> {
  const folder = cachedFolders[folderId];
  if (!folder) return;

  const newName = prompt('Enter new folder name:', folder.name);
  if (newName === null || newName.trim() === folder.name) return;

  const trimmedName = newName.trim();
  if (!trimmedName) {
    alert('Folder name cannot be empty');
    return;
  }

  // Check for duplicate
  const exists = await folderStorage.folderNameExists(trimmedName);
  if (exists && trimmedName.toLowerCase() !== folder.name.toLowerCase()) {
    alert('A folder with this name already exists');
    return;
  }

  await folderStorage.renameFolder(folderId, trimmedName);
  cachedFolders = await folderStorage.getFolders();
  renderSidebar();
}

/**
 * Handle folder delete in modal (Phase 5f placeholder)
 */
async function handleDeleteFolderInModal(folderId: string): Promise<void> {
  const folder = cachedFolders[folderId];
  if (!folder) return;

  const confirmed = confirm(`Delete folder "${folder.name}"?\n\nPlaylists in this folder will become unassigned.`);
  if (!confirmed) return;

  await folderStorage.deleteFolder(folderId);
  cachedFolders = await folderStorage.getFolders();

  // If deleted folder was selected, switch to Unassigned
  if (selectedFolderId === folderId) {
    selectedFolderId = null;
  }

  renderSidebar();
  renderContent();
}

// ============================================================================
// Export/Import (Phase 6)
// ============================================================================

/**
 * Generate a date string for the export filename (YYYY-MM-DD format)
 */
function getExportDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Handle export button click - downloads folders as JSON file
 */
async function handleExport(): Promise<void> {
  try {
    // Build export data
    const exportData = await folderStorage.buildExportData();

    // Convert to JSON string with pretty printing
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create temporary download link and trigger download
    const filename = `ytcatalog-folders-${getExportDateString()}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('YTCatalog: Export failed', error);
    alert('Failed to export folders. Please try again.');
  }
}

/**
 * Handle import button click - opens file picker and imports folders from JSON
 */
async function handleImport(): Promise<void> {
  // Create hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';

  // Handle file selection
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      document.body.removeChild(fileInput);
      return;
    }

    try {
      // Read file contents
      const text = await file.text();

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        alert('Invalid file format: not valid JSON');
        document.body.removeChild(fileInput);
        return;
      }

      // Validate structure
      const validationError = folderStorage.validateImportData(data);
      if (validationError) {
        alert(validationError);
        document.body.removeChild(fileInput);
        return;
      }

      // Import folders
      const result = await folderStorage.importFolders(data as ExportData);

      if (result.success) {
        // Refresh cached folders and re-render
        cachedFolders = await folderStorage.getFolders();
        renderSidebar();
        renderContent();
        alert(result.message);
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('YTCatalog: Import failed', error);
      alert('Failed to import folders. Please try again.');
    }

    // Clean up
    document.body.removeChild(fileInput);
  });

  // Handle cancel (no file selected)
  fileInput.addEventListener('cancel', () => {
    document.body.removeChild(fileInput);
  });

  // Trigger file picker
  document.body.appendChild(fileInput);
  fileInput.click();
}

// ============================================================================
// Content Area (Phase 5c/5d - Playlist Grid with Click-to-Assign)
// ============================================================================

/**
 * Build the HTML for a single playlist card (text-only layout)
 */
function buildPlaylistCardHTML(playlist: PlaylistInfo): string {
  const isSelected = selectedPlaylistId === playlist.id;
  const selectedClass = isSelected ? 'selected' : '';

  // Extract just the number from video count (e.g., "42 videos" -> "42")
  const countMatch = playlist.videoCount.match(/(\d+)/);
  const countDisplay = countMatch ? countMatch[1] : '';

  return `
    <div class="ytcatalog-playlist-card ${selectedClass}" data-playlist-id="${playlist.id}">
      <div class="ytcatalog-playlist-title" title="${escapeHtml(playlist.title)}">${escapeHtml(playlist.title)}</div>
      <div class="ytcatalog-playlist-meta">
        <span class="ytcatalog-playlist-channel">${escapeHtml(playlist.channelName)}</span>
        ${countDisplay ? `<span class="ytcatalog-playlist-separator">•</span><span class="ytcatalog-playlist-count">${countDisplay}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render the content area (playlist grid)
 */
function renderContent(): void {
  if (!modalElement) return;

  const content = modalElement.querySelector('.ytcatalog-modal-content');
  if (!content) return;

  const playlists = getPlaylistsForFolder(selectedFolderId);
  const folderName = selectedFolderId === null
    ? 'Unassigned'
    : (cachedFolders[selectedFolderId]?.name || 'Unknown');

  if (playlists.length === 0) {
    content.innerHTML = `
      <div class="ytcatalog-content-empty">
        <p>No playlists in "${escapeHtml(folderName)}"</p>
      </div>
    `;
    return;
  }

  const playlistCardsHTML = playlists.map(p => buildPlaylistCardHTML(p)).join('');

  content.innerHTML = `
    <div class="ytcatalog-content-header">
      <h3>${escapeHtml(folderName)} (${playlists.length})</h3>
    </div>
    <div class="ytcatalog-playlist-grid">
      ${playlistCardsHTML}
    </div>
  `;

  // Attach click handlers to playlist cards
  attachPlaylistCardEventListeners();
}

/**
 * Attach click handlers to playlist cards for selection
 */
function attachPlaylistCardEventListeners(): void {
  if (!modalElement) return;

  const cards = modalElement.querySelectorAll('.ytcatalog-playlist-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const playlistId = (card as HTMLElement).dataset.playlistId;
      if (!playlistId) return;

      // Toggle selection: if already selected, deselect; otherwise select
      if (selectedPlaylistId === playlistId) {
        selectedPlaylistId = null;
      } else {
        selectedPlaylistId = playlistId;
      }

      // Update visual state
      updatePlaylistSelectionUI();
    });
  });
}

/**
 * Update the visual selection state of playlist cards
 */
function updatePlaylistSelectionUI(): void {
  if (!modalElement) return;

  const cards = modalElement.querySelectorAll('.ytcatalog-playlist-card');
  cards.forEach(card => {
    const playlistId = (card as HTMLElement).dataset.playlistId;
    if (playlistId === selectedPlaylistId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

/**
 * Create the modal DOM structure
 */
function createModalElement(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'ytcatalog-modal-overlay';
  overlay.id = 'ytcatalog-modal';

  const container = document.createElement('div');
  container.className = 'ytcatalog-modal-container';

  // Header
  const header = document.createElement('div');
  header.className = 'ytcatalog-modal-header';
  header.innerHTML = `
    <div class="ytcatalog-modal-header-text">
      <h2 class="ytcatalog-modal-title">Organize Playlists</h2>
      <p class="ytcatalog-modal-subtitle">Click a playlist, then click a folder to move it</p>
    </div>
    <button class="ytcatalog-modal-close" aria-label="Close modal">
      <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `;

  // Body (placeholder for Phase 5b/5c)
  const body = document.createElement('div');
  body.className = 'ytcatalog-modal-body';
  body.innerHTML = `
    <div class="ytcatalog-modal-sidebar">
      <!-- Folder sidebar will go here in Phase 5b -->
      <p style="color: #aaa; padding: 16px;">Folder sidebar (Phase 5b)</p>
    </div>
    <div class="ytcatalog-modal-content">
      <!-- Playlist grid will go here in Phase 5c -->
      <p style="color: #aaa; padding: 16px;">Playlist grid (Phase 5c)</p>
    </div>
  `;

  container.appendChild(header);
  container.appendChild(body);
  overlay.appendChild(container);

  return overlay;
}

// ============================================================================
// Modal Open/Close
// ============================================================================

/**
 * Open the organization modal
 */
export async function openModal(): Promise<void> {
  if (isModalOpen) return;

  // Create modal if it doesn't exist
  if (!modalElement) {
    modalElement = createModalElement();
    document.body.appendChild(modalElement);
    attachModalEventListeners();
  }

  // Load data for the modal
  cachedFolders = await folderStorage.getFolders();
  cachedPlaylists = scrapePlaylistsForModal();
  selectedFolderId = null; // Start with Unassigned selected

  // Show modal
  modalElement.classList.add('open');
  isModalOpen = true;

  // Render sidebar and content
  renderSidebar();
  renderContent();

  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';
}

/**
 * Close the organization modal
 */
export function closeModal(): void {
  if (!isModalOpen || !modalElement) return;

  modalElement.classList.remove('open');
  isModalOpen = false;

  // Restore body scroll
  document.body.style.overflow = '';

  // Notify that folders may have changed
  document.dispatchEvent(new CustomEvent('ytcatalog-folders-changed'));
}

/**
 * Check if modal is currently open
 */
export function isOpen(): boolean {
  return isModalOpen;
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Attach event listeners to modal elements
 */
function attachModalEventListeners(): void {
  if (!modalElement) return;

  // Close button click
  const closeButton = modalElement.querySelector('.ytcatalog-modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
  }

  // Click outside modal container (on overlay) to close
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
      closeModal();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Handle Escape key press
 */
function handleEscapeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isModalOpen) {
    closeModal();
  }
}

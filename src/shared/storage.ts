/**
 * YTCatalog Storage Utilities
 * Handles all chrome.storage.local operations
 */

import { Folder, StorageState, ExportData, ExportFolder, ImportResult } from './types';

/**
 * Check if chrome.storage API is available
 * Returns false if extension context was invalidated (e.g., after extension reload)
 */
function isStorageAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' &&
           typeof chrome.storage !== 'undefined' &&
           typeof chrome.storage.local !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Result type for folder creation
 */
export type CreateFolderResult =
  | { success: true; folder: Folder }
  | { success: false; error: 'empty_name' | 'duplicate_name' };

/**
 * Storage utility class for managing folder data
 */
export class FolderStorage {
  /**
   * Get all folders from storage
   */
  async getFolders(): Promise<Record<string, Folder>> {
    if (!isStorageAvailable()) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return {};
    }
    const result = await chrome.storage.local.get('folders');
    return (result.folders as Record<string, Folder>) || ({} as Record<string, Folder>);
  }

  /**
   * Save all folders to storage
   */
  async saveFolders(folders: Record<string, Folder>): Promise<void> {
    if (!isStorageAvailable()) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return;
    }
    await chrome.storage.local.set({ folders });
  }

  /**
   * Get a single folder by ID
   */
  async getFolder(id: string): Promise<Folder | undefined> {
    const folders = await this.getFolders();
    return folders[id];
  }

  /**
   * Check if a folder name already exists (case-insensitive)
   */
  async folderNameExists(name: string): Promise<boolean> {
    const folders = await this.getFolders();
    const normalizedName = name.trim().toLowerCase();
    return Object.values(folders).some(
      (folder) => folder.name.toLowerCase() === normalizedName
    );
  }

  /**
   * Create a new folder with validation
   * Returns success with folder, or error type
   */
  async createFolder(name: string): Promise<CreateFolderResult> {
    const trimmedName = name.trim();

    // Validate: non-empty
    if (!trimmedName) {
      return { success: false, error: 'empty_name' };
    }

    // Validate: no duplicate
    if (await this.folderNameExists(trimmedName)) {
      return { success: false, error: 'duplicate_name' };
    }

    const folders = await this.getFolders();
    const id = this.generateId();
    const folder: Folder = {
      id,
      name: trimmedName,
      playlistIds: [],
    };
    folders[id] = folder;
    await this.saveFolders(folders);
    return { success: true, folder };
  }

  /**
   * Delete a folder by ID
   */
  async deleteFolder(id: string): Promise<void> {
    const folders = await this.getFolders();
    delete folders[id];
    await this.saveFolders(folders);

    // If the deleted folder was selected, clear selection
    const selectedId = await this.getSelectedFolderId();
    if (selectedId === id) {
      await this.setSelectedFolderId(null);
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(id: string, newName: string): Promise<void> {
    const folders = await this.getFolders();
    if (folders[id]) {
      folders[id].name = newName;
      await this.saveFolders(folders);
    }
  }

  /**
   * Add a playlist to a folder
   */
  async addPlaylistToFolder(folderId: string, playlistId: string): Promise<void> {
    const folders = await this.getFolders();

    // Remove playlist from any existing folder first
    for (const folder of Object.values(folders)) {
      const index = folder.playlistIds.indexOf(playlistId);
      if (index > -1) {
        folder.playlistIds.splice(index, 1);
      }
    }

    // Add to new folder
    if (folders[folderId]) {
      folders[folderId].playlistIds.push(playlistId);
    }

    await this.saveFolders(folders);
  }

  /**
   * Remove a playlist from its folder
   */
  async removePlaylistFromFolder(playlistId: string): Promise<void> {
    const folders = await this.getFolders();

    for (const folder of Object.values(folders)) {
      const index = folder.playlistIds.indexOf(playlistId);
      if (index > -1) {
        folder.playlistIds.splice(index, 1);
        break;
      }
    }

    await this.saveFolders(folders);
  }

/**
   * Get the complete storage state
   */
  async getState(): Promise<StorageState> {
    if (!isStorageAvailable()) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return { folders: {} };
    }
    const result = await chrome.storage.local.get(['folders', 'selectedFolderId']);
    return {
      folders: (result.folders as Record<string, Folder>) || ({} as Record<string, Folder>),
      selectedFolderId: result.selectedFolderId as string | undefined,
    };
  }

  /**
   * Get the currently selected folder ID
   * Returns null if "all" is selected (no specific folder)
   */
  async getSelectedFolderId(): Promise<string | null> {
    if (!isStorageAvailable()) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return null;
    }
    const result = await chrome.storage.local.get('selectedFolderId');
    return (result.selectedFolderId as string) || null;
  }

  /**
   * Set the selected folder ID
   * Pass null to select "all playlists"
   */
  async setSelectedFolderId(id: string | null): Promise<void> {
    if (!isStorageAvailable()) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return;
    }
    if (id === null) {
      await chrome.storage.local.remove('selectedFolderId');
    } else {
      await chrome.storage.local.set({ selectedFolderId: id });
    }
  }

/**
   * Generate a unique ID for folders
   */
  private generateId(): string {
    return `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

/**
   * Build export data from current folders
   * Returns simplified format with name + playlistIds only (no internal IDs)
   */
  async buildExportData(): Promise<ExportData> {
    const folders = await this.getFolders();

    const exportFolders: ExportFolder[] = Object.values(folders)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((folder) => ({
        name: folder.name,
        playlistIds: [...folder.playlistIds],
      }));

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: exportFolders,
    };
  }

  /**
   * Validate import data structure
   * Returns error message if invalid, null if valid
   */
  validateImportData(data: unknown): string | null {
    if (!data || typeof data !== 'object') {
      return 'Invalid file format: expected JSON object';
    }

    const obj = data as Record<string, unknown>;

    // Check version field
    if (typeof obj.version !== 'number') {
      return 'Invalid file format: missing or invalid version field';
    }

    // Check folders array
    if (!Array.isArray(obj.folders)) {
      return 'Invalid file format: missing or invalid folders array';
    }

    // Validate each folder
    for (let i = 0; i < obj.folders.length; i++) {
      const folder = obj.folders[i] as Record<string, unknown>;

      if (!folder || typeof folder !== 'object') {
        return `Invalid folder at index ${i}: expected object`;
      }

      if (typeof folder.name !== 'string' || !folder.name.trim()) {
        return `Invalid folder at index ${i}: missing or empty name`;
      }

      if (!Array.isArray(folder.playlistIds)) {
        return `Invalid folder "${folder.name}": missing or invalid playlistIds array`;
      }

      // Validate playlistIds are strings
      for (const id of folder.playlistIds) {
        if (typeof id !== 'string') {
          return `Invalid folder "${folder.name}": playlistIds must be strings`;
        }
      }
    }

    return null; // Valid
  }

  /**
   * Import folders from export data
   * Merge strategy: Replace existing folders with same name (D-21)
   * Playlist assignment: Last folder wins (D-22)
   */
  async importFolders(data: ExportData): Promise<ImportResult> {
    try {
      const existingFolders = await this.getFolders();
      const importedFolders = data.folders;

      // Track playlist assignments to handle "last folder wins" rule
      // Maps playlistId -> folderId
      const playlistAssignments = new Map<string, string>();

      // First pass: Collect all playlist assignments from existing folders
      // (these may be overwritten by imported folders)
      for (const folder of Object.values(existingFolders)) {
        for (const playlistId of folder.playlistIds) {
          playlistAssignments.set(playlistId, folder.id);
        }
      }

      // Build a map of existing folder names (lowercase) to their IDs
      const existingNameToId = new Map<string, string>();
      for (const folder of Object.values(existingFolders)) {
        existingNameToId.set(folder.name.toLowerCase(), folder.id);
      }

      // Process imported folders
      let foldersImported = 0;
      for (const importedFolder of importedFolders) {
        const folderName = importedFolder.name.trim();
        const existingId = existingNameToId.get(folderName.toLowerCase());

        let folderId: string;

        if (existingId) {
          // Replace existing folder with same name
          folderId = existingId;
          existingFolders[folderId] = {
            id: folderId,
            name: folderName,
            playlistIds: [], // Will be populated below
          };
        } else {
          // Create new folder
          folderId = this.generateId();
          existingFolders[folderId] = {
            id: folderId,
            name: folderName,
            playlistIds: [],
          };
          existingNameToId.set(folderName.toLowerCase(), folderId);
        }

        // Update playlist assignments (last folder wins)
        for (const playlistId of importedFolder.playlistIds) {
          playlistAssignments.set(playlistId, folderId);
        }

        foldersImported++;
      }

      // Second pass: Rebuild playlistIds arrays based on final assignments
      for (const folder of Object.values(existingFolders)) {
        folder.playlistIds = [];
      }

      for (const [playlistId, folderId] of playlistAssignments) {
        if (existingFolders[folderId]) {
          existingFolders[folderId].playlistIds.push(playlistId);
        }
      }

      // Save updated folders
      await this.saveFolders(existingFolders);

      return {
        success: true,
        foldersImported,
        message: `Successfully imported ${foldersImported} folder${foldersImported === 1 ? '' : 's'}`,
      };
    } catch (error) {
      console.error('YTCatalog: Import failed', error);
      return {
        success: false,
        error: 'Failed to import folders. Please try again.',
      };
    }
  }
}

// Export a singleton instance
export const folderStorage = new FolderStorage();

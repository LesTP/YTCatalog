/**
 * YTCatalog Storage Utilities
 * Handles all chrome.storage.local operations
 */

import { Folder, StorageState } from './types';

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
    const result = await chrome.storage.local.get('folders');
    return (result.folders as Record<string, Folder>) || ({} as Record<string, Folder>);
  }

  /**
   * Save all folders to storage
   */
  async saveFolders(folders: Record<string, Folder>): Promise<void> {
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
    const result = await chrome.storage.local.get('selectedFolderId');
    return (result.selectedFolderId as string) || null;
  }

  /**
   * Set the selected folder ID
   * Pass null to select "all playlists"
   */
  async setSelectedFolderId(id: string | null): Promise<void> {
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
}

// Export a singleton instance
export const folderStorage = new FolderStorage();

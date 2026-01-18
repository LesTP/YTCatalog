/**
 * YTCatalog Type Definitions
 */

/**
 * Represents a folder containing playlists
 */
export interface Folder {
  id: string;
  name: string;
  playlistIds: string[];
}

/**
 * The complete storage state for YTCatalog
 * Note: "unassigned" playlists are computed dynamically (all scraped - all in folders)
 */
export interface StorageState {
  folders: Record<string, Folder>;
  selectedFolderId?: string; // Persisted folder selection; undefined = "all"
}

/**
 * Message types for communication between content scripts and background
 */
export type MessageType =
  | 'GET_FOLDERS'
  | 'SAVE_FOLDERS'
  | 'FOLDER_UPDATED';

/**
 * Message structure for extension communication
 */
export interface ExtensionMessage {
  type: MessageType;
  data?: unknown;
}

/**
 * Folder data for export (simplified format without internal IDs)
 */
export interface ExportFolder {
  name: string;
  playlistIds: string[];
}

/**
 * Export data structure for JSON file
 */
export interface ExportData {
  version: number;
  exportedAt: string;
  folders: ExportFolder[];
}

/**
 * Result type for import operations
 */
export type ImportResult =
  | { success: true; foldersImported: number; message: string }
  | { success: false; error: string };

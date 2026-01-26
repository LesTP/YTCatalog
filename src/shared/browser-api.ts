/**
 * YTCatalog Browser API Compatibility Layer
 * Provides unified API that works in both Chrome and Firefox
 *
 * Chrome uses: chrome.storage, chrome.runtime
 * Firefox uses: browser.storage, browser.runtime (also provides chrome.* alias)
 *
 * This module detects the available API and exports a unified interface.
 */

// Declare Firefox's `browser` global for TypeScript
// Firefox's WebExtensions API uses `browser` namespace with same shape as Chrome's `chrome`
declare const browser: typeof chrome | undefined;

type BrowserAPI = typeof chrome;

/**
 * Detect and return the available browser extension API
 * Chrome: uses `chrome` global
 * Firefox: uses `browser` global (also provides `chrome` alias, but `browser` is preferred)
 */
function detectBrowserAPI(): BrowserAPI | null {
  try {
    // Prefer `browser` (Firefox native) over `chrome` (Chrome native / Firefox alias)
    if (typeof browser !== 'undefined' && browser.storage && browser.runtime) {
      return browser as unknown as BrowserAPI;
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime) {
      return chrome;
    }
  } catch {
    // Access to globals may throw in some contexts
  }
  return null;
}

/**
 * The detected browser extension API (chrome or browser namespace)
 * May be null if extension context is invalidated
 */
const browserAPI = detectBrowserAPI();

/**
 * Check if extension storage API is available
 * Returns false if:
 * - Extension context was invalidated (e.g., after extension reload)
 * - Running outside extension context
 */
export function isStorageAvailable(): boolean {
  try {
    const api = detectBrowserAPI();
    return api !== null &&
           typeof api.storage !== 'undefined' &&
           typeof api.storage.local !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Get the storage.local API
 * Returns null if not available
 */
export function getStorageLocal(): typeof chrome.storage.local | null {
  if (!isStorageAvailable()) {
    return null;
  }
  return browserAPI!.storage.local;
}

/**
 * Get the runtime API
 * Returns null if not available
 */
export function getRuntime(): typeof chrome.runtime | null {
  try {
    const api = detectBrowserAPI();
    if (api && api.runtime) {
      return api.runtime;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Storage helper functions that handle unavailable API gracefully
 */
export const storage = {
  async get(keys: string | string[]): Promise<Record<string, unknown>> {
    const local = getStorageLocal();
    if (!local) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return {};
    }
    return local.get(keys);
  },

  async set(items: Record<string, unknown>): Promise<void> {
    const local = getStorageLocal();
    if (!local) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return;
    }
    return local.set(items);
  },

  async remove(keys: string | string[]): Promise<void> {
    const local = getStorageLocal();
    if (!local) {
      console.warn('YTCatalog: Extension context invalidated. Please refresh the page.');
      return;
    }
    return local.remove(keys);
  },
};

/**
 * Runtime helper that provides access to runtime events
 * Use getRuntime() for direct access when needed
 */
export const runtime = {
  get onInstalled() {
    const rt = getRuntime();
    return rt?.onInstalled ?? null;
  },

  get onMessage() {
    const rt = getRuntime();
    return rt?.onMessage ?? null;
  },
};

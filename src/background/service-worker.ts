/**
 * YTCatalog Background Service Worker
 * Handles storage operations and extension lifecycle events
 * Compatible with both Chrome and Firefox
 */

import { getRuntime, storage } from '../shared/browser-api';

console.log('YTCatalog: Background service worker loaded');

// Get runtime API
const runtime = getRuntime();

// Listen for installation
if (runtime?.onInstalled) {
  runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('YTCatalog: Extension installed');
      // Initialize storage with empty state
      storage.set({
        folders: {},
      });
    } else if (details.reason === 'update') {
      console.log('YTCatalog: Extension updated');
    }
  });
}

// Listen for messages from content scripts
if (runtime?.onMessage) {
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('YTCatalog: Received message', message);

    if (message.type === 'GET_FOLDERS') {
      storage.get(['folders']).then((result) => {
        sendResponse(result);
      });
      return true; // Keep message channel open for async response
    }

    return false;
  });
}

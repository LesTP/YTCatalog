/**
 * YTCatalog Background Service Worker
 * Handles storage operations and extension lifecycle events
 */

console.log('YTCatalog: Background service worker loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('YTCatalog: Extension installed');
    // Initialize storage with empty state
    chrome.storage.local.set({
      folders: {},
      unassignedPlaylists: []
    });
  } else if (details.reason === 'update') {
    console.log('YTCatalog: Extension updated');
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('YTCatalog: Received message', message);

  if (message.type === 'GET_FOLDERS') {
    chrome.storage.local.get(['folders', 'unassignedPlaylists'], (result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }

  return false;
});

// Obsidium Background Service Worker

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(function(tab) {
  if (chrome.sidePanel) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Set up side panel behavior on install
chrome.runtime.onInstalled.addListener(function() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'openMainApp') {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/main.html') });
    sendResponse({ success: true });
  }
  return true;
});

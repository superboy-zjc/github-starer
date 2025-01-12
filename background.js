// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('GitHub Star Counter installed');
});

// Add debug commands to inspect cache
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'inspectCache') {
        chrome.storage.local.get(['starCounts'], function(result) {
            console.log('Star Count Cache:', result.starCounts || {});
            sendResponse(result.starCounts || {});
        });
        return true; // Will respond asynchronously
    }
    
    if (request.action === 'clearCache') {
        chrome.storage.local.remove(['starCounts'], function() {
            console.log('Cache cleared');
            sendResponse({ success: true });
        });
        return true; // Will respond asynchronously
    }
});

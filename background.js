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

/*
 @Author: Gavin Zhong
 @Date: 2025-01-31
 @Description: background listener for monitoring API error messages and create DOM notification for user.
 This handle the issues such as API key expired or invalid
*/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'API_ERROR') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (errorMsg) => {
                        const div = document.createElement('div');
                        div.style.position = 'fixed';
                        div.style.top = '10px';
                        div.style.right = '10px';
                        div.style.backgroundColor = '#ff4444';
                        div.style.color = 'white';
                        div.style.padding = '10px';
                        div.style.borderRadius = '5px';
                        div.style.zIndex = '999999';
                        div.style.cursor = 'pointer';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.gap = '10px';
                        
                        const messageSpan = document.createElement('span');
                        messageSpan.textContent = errorMsg;
                        
                        const link = document.createElement('a');
                        link.textContent = 'Update API Key';
                        link.style.color = 'white';
                        link.style.textDecoration = 'underline';
                        link.style.fontWeight = 'bold';
                        link.style.marginLeft = '10px';
                        link.style.cursor = 'pointer';
                        link.onclick = (e) => {
                            e.stopPropagation();
                            chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
                        };
                        
                        div.appendChild(messageSpan);
                        div.appendChild(link);
                        
                        document.body.appendChild(div);
                        setTimeout(() => div.remove(), 5000);
                    },
                    args: [message.error]
                });
            }
        });
        
        // Send response to acknowledge receipt
        sendResponse({received: true});
    } else if (message.type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
    }
    return true; // Keep the message channel open for sendResponse
});

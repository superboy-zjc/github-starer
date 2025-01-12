// In-memory cache for the current session
const starCountCache = new Map();

async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['githubApiKey'], function(result) {
            resolve(result.githubApiKey);
        });
    });
}

async function getCachedStarCount(repoPath) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['starCounts'], function(result) {
            const cache = result.starCounts || {};
            const cacheEntry = cache[repoPath];
            
            if (cacheEntry) {
                resolve(cacheEntry.stars);
            } else {
                resolve(null);
            }
        });
    });
}

async function setCachedStarCount(repoPath, stars) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['starCounts'], function(result) {
            const cache = result.starCounts || {};
            cache[repoPath] = {
                stars: stars,
                timestamp: Date.now() // Keep timestamp for reference, but don't use it for expiration
            };
            
            chrome.storage.local.set({ starCounts: cache }, resolve);
        });
    });
}

async function getStarCount(repoPath) {
    // Check in-memory cache first
    if (starCountCache.has(repoPath)) {
        return starCountCache.get(repoPath);
    }

    // Check persistent cache
    const cachedStars = await getCachedStarCount(repoPath);
    if (cachedStars !== null) {
        starCountCache.set(repoPath, cachedStars);
        return cachedStars;
    }

    try {
        const apiKey = await getApiKey();
        const headers = apiKey ? { 'Authorization': `token ${apiKey}` } : {};
        
        const response = await fetch(`https://api.github.com/repos/${repoPath}`, {
            headers: headers
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const stars = data.stargazers_count;

        // Save to both caches
        starCountCache.set(repoPath, stars);
        await setCachedStarCount(repoPath, stars);

        return stars;
    } catch (error) {
        console.error('Error fetching star count:', error);
        return null;
    }
}

function createStarCountElement(stars) {
    const span = document.createElement('span');
    span.textContent = `⭐ ${stars}`;
    span.className = 'github-star-counter';
    span.style.marginLeft = '8px';
    return span;
}

async function addStarCount() {
    const resultsList = document.querySelector('div[data-testid="results-list"]');
    if (!resultsList) {
        return;
    }

    const searchTitles = resultsList.querySelectorAll('div[class*="search-title"]');
    if (searchTitles.length === 0) return;

    for (const searchTitle of searchTitles) {
        // Skip if we already added star count
        if (searchTitle.childNodes[0]?.nextElementSibling?.classList.contains('github-star-counter')) continue;

        const repoPath = searchTitle.childNodes[0]?.getAttribute('title')?.split(' ')[0];
        if (!repoPath) continue;

        const stars = await getStarCount(repoPath);
        if (stars === null) continue;

        const starCountElement = createStarCountElement(stars);
        searchTitle.childNodes[0].insertAdjacentElement('afterend', starCountElement);
    }
}


// Monitor for navigation changes (tab switches, search updates)
const navObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            const hasNewResults = [...mutation.addedNodes].some(node => {
                return node.nodeType === Node.ELEMENT_NODE && 
                       (node.querySelector('div[class*="search-title"]') !== null ||
                        node.matches('div[class*="search-title"]'));
            });
            
            if (hasNewResults) {
                setTimeout(() => {
                    // Re-attach observer to new results container
                    const newResultsContainer = document.querySelector('div[class*="search-title"]');
                    if (newResultsContainer) {
                        addStarCount();
                        // resultsObserver.observe(newResultsContainer, { childList: true, subtree: true });
                    }
                    // addStarCount();
                }, 0);
                break;
            }
        }
    }
});

const mainContainer = document.querySelector('html');
if (mainContainer) {
    navObserver.observe(mainContainer, { childList: true, subtree: true });
}

// Initial load
addStarCount();

// Debug functions to inspect caches
async function inspectCaches() {
    // Print in-memory cache
    console.log('In-memory Cache:');
    console.log(Object.fromEntries(starCountCache));

    // Get persistent cache from background script
    const persistentCache = await chrome.runtime.sendMessage({ action: 'inspectCache' });
    console.log('Persistent Cache:');
    console.log(persistentCache);
}

// Add to window for easy access from console
window.inspectCaches = inspectCaches;
window.clearCaches = async function() {
    // Clear in-memory cache
    starCountCache.clear();
    
    // Clear persistent cache via background script
    await chrome.runtime.sendMessage({ action: 'clearCache' });
    console.log('All caches cleared');
};

// // Function to wait for element to be available
// function waitForChanged(selector, maxAttempts = 1000) {
//     return new Promise((resolve, reject) => {
//         let attempts = 0;
        
//         function checkElement() {
//             const element = document.querySelector(selector);
//             const currentClass = element.className;
//             chrome.storage.local.get(['lastContainerClass'], function(result) {
//                 const lastClass = result.lastContainerClass;
//                 if (currentClass !== lastClass) {
//                     resolve(element);
//                     return;
//                 }
//             });
            
//             attempts++;
//             if (attempts >= maxAttempts) {
//                 reject(new Error(`Element ${selector} not found after ${maxAttempts} attempts`));
//                 return;
//             }
            
//             setTimeout(checkElement, 500); // Check every 500ms
//         }
        
//         checkElement();
//     });
// }

// Function to handle navigation events
// async function handleNavigation() {
//     try {
//         // Wait for results container to be available
//         console.log('Waiting due to navigation event...');
//         // await waitForChanged('div[data-testid="results-list"]');
//         await waitForElement('div[data-testid="results-list"]');
//         await waitForElement('a[data-hovercard-url]');
//         addStarCount();
//     } catch (error) {
//         console.log('Results container not found after maximum attempts');
//     }
// }

// Monitor for dynamic content changes in search results
// const resultsObserver = new MutationObserver((mutations) => {
//     for (const mutation of mutations) {
//         // Skip if the change was adding our own star count
//         if (mutation.target.classList?.contains('github-star-counter')) continue;
        
//         // Only process if new nodes were added and they're not our star counts
//         if (mutation.addedNodes.length && 
//             ![...mutation.addedNodes].some(node => node.classList?.contains('github-star-counter'))) {
//             addStarCount();
//             break;
//         }
//     }
// });


// // Start observing
// const resultsContainer = document.querySelector('div[data-testid="results-list"]');
// if (resultsContainer) {
//     resultsObserver.observe(resultsContainer, { childList: true, subtree: true });
// }

// Observe the main navigation container

// Handle all possible navigation events
// window.addEventListener('popstate', handleNavigation);           // Browser back/forward
// window.addEventListener('hashchange', handleNavigation);         // Hash changes
// document.addEventListener('locationchange', handleNavigation);   // Custom event some sites use
// window.addEventListener('pushstate', handleNavigation);          // History API
// window.addEventListener('replacestate', handleNavigation);       // History API

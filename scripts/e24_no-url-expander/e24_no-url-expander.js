// ==UserScript==
// @name         e24.no URL Expander
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Expands E24's short URLs to their full form on hover
// @match        https://e24.no/
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Helper function to make HTTP requests that works with both TamperMonkey and GreaseMonkey
    async function makeRequest(shortUrl) {
        // For Greasemonkey
        if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
            return new Promise((resolve) => {
                GM.xmlHttpRequest({
                    method: 'HEAD',
                    url: shortUrl,
                    followRedirect: false,
                    onload: function(response) {
                        const actualUrl = response.finalUrl || response.responseHeaders.match(/location: (.*)/i)?.[1];
                        resolve(actualUrl || shortUrl);
                    },
                    onerror: function() {
                        resolve(shortUrl);
                    }
                });
            });
        }
        // For Tampermonkey
        else if (typeof GM_xmlhttpRequest !== 'undefined') {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'HEAD',
                    url: shortUrl,
                    followRedirect: false,
                    onload: function(response) {
                        const actualUrl = response.finalUrl || response.responseHeaders.match(/location: (.*)/i)?.[1];
                        resolve(actualUrl || shortUrl);
                    },
                    onerror: function() {
                        resolve(shortUrl);
                    }
                });
            });
        }
        // Fallback to fetch for browsers that support it
        else {
            try {
                const response = await fetch(shortUrl, {
                    method: 'HEAD',
                    redirect: 'manual'
                });
                if (response.status === 301 || response.status === 302) {
                    return response.headers.get('location') || shortUrl;
                }
                return shortUrl;
            } catch (error) {
                return shortUrl;
            }
        }
    }

    // Process a single link
    function setupHoverHandler(link) {
        if (link.hasHoverHandler) return; // Prevent duplicate handlers

        const shortUrl = link.href;
        let expandedUrl = null;
        let expandTimeout = null;

        link.addEventListener('mouseenter', () => {
            // Set a timeout to prevent unnecessary requests on quick hover
            expandTimeout = setTimeout(async () => {
                if (!expandedUrl) {
                    expandedUrl = await makeRequest(shortUrl);
                    if (expandedUrl && expandedUrl !== shortUrl) {
                        // Force browser to update hover status by cloning and replacing the link
                        const newLink = link.cloneNode(true);
                        newLink.href = expandedUrl;
                        newLink.style.textDecoration = 'underline';
                        newLink.title = expandedUrl;
                        newLink.hasHoverHandler = true;
                        link.parentNode.replaceChild(newLink, link);

                        // Reattach event listeners to the new link
                        setupHoverHandler(newLink);
                    }
                } else {
                    // Force browser to update hover status
                    const newLink = link.cloneNode(true);
                    newLink.href = expandedUrl;
                    newLink.style.textDecoration = 'underline';
                    newLink.title = expandedUrl;
                    newLink.hasHoverHandler = true;
                    link.parentNode.replaceChild(newLink, link);

                    // Reattach event listeners to the new link
                    setupHoverHandler(newLink);
                }
            }, 300); // 300ms delay before expanding
        });

        link.addEventListener('mouseleave', () => {
            // Clear timeout if user moves mouse away quickly
            if (expandTimeout) {
                clearTimeout(expandTimeout);
            }
            // Remove visual indicator but keep the expanded URL
            link.style.textDecoration = '';
            link.title = '';
        });

        link.hasHoverHandler = true; // Mark as processed
    }

    // Setup handlers for all matching links
    function processLinks() {
        const links = document.querySelectorAll('a[href^="https://e24.no/i/"]');
        links.forEach(setupHoverHandler);
    }

    // Run on page load
    processLinks();

     // Watch for dynamic content changes
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                processLinks();
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

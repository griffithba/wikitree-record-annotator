// wtplus.js

(() => {
  "use strict";

  const _pageCache = new Map();
  const _profileCache = new Map();
  

  async function getFramesForPage(site, book, page) {
    const pageData = await _getCachedPage(site, book, page);
    const profiles = pageData?.profiles || [];
    return profiles;
  }


  async function getPageCitation(site, book, page) {
    const pageData = await _getCachedPage(site, book, page);

    return pageData?.profiles[0]?.reference || null;
  }


  async function getPageReferrers(site, book, page) {
    const pageData = await _getCachedPage(site, book, page);

    return pageData?.links || [];
  }


  async function _getCachedPage(site, book, page) {
    const key = `${site}|${book}|${page}`;

    if (!_pageCache.has(key)) {
      const response = await _wtplusImageFramesGet(site, book, page);
              
      if (response?.error) {
        console.warn("Failed to fetch page data from WT+ API for", {site, book, page}, "Response:", response);
        return null;
      }
      _pageCache.set(key, response);
    }

    return _pageCache.get(key);
  }


  async function _wtplusImageFramesGet(site, book, page) {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_FRAMES_FOR_PAGE",
          site,
          book,
          page
        },
        resolve
      );
    });

    return response.response;
  }


  async function getFramesForProfile(wtId) {
    
  }


  async function addFrame(frame) {
    
  }


  async function deleteFrame(site, book, page, frameId) {
    
  }


  window.wtplusAPI = {
    getFramesForPage,
    getPageReferrers,
    getPageCitation,
    getFramesForProfile,
    addFrame,
    deleteFrame
  }

})();

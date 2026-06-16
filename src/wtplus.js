// wtplus.js

(() => {
  "use strict";

  const _pageCache = new Map();
  const _profileCache = new Map();

  let _site = null; 
  let _book = null;
  let _page = null;

  let _pageInfo = null;

  async function getFramesForPage() {
    const pageData = await _getCachedPage();
    const profiles = pageData?.profiles || [];
    return profiles;
  }


  async function getPageCitation() {
    const pageData = await _getCachedPage();

    return pageData?.profiles[0]?.reference || null;
  }


  async function getPageReferrers() {
    const pageData = await _getCachedPage();

    return pageData?.links || [];
  }


  async function _getCachedPage() {
    const keyObject = archiveProvider.getCurrentPageKey();
    _site = keyObject.site;
    _book = keyObject.book;
    _page = keyObject.page;
    const key = `${_site}|${_book}|${_page}`;

    if (!_pageCache.has(key)) {
      const response = await _wtplusImageFramesGet();
              
      if (response?.error) {
        console.warn("Failed to fetch page data from WT+ API for", {_site, _book, _page}, "Response:", response);
        return null;
      }
      const pageData = response.response;
      _pageInfo = pageData?.profiles[0]?.info;
      _pageCache.set(key, pageData);
    }

    return _pageCache.get(key);
  }


  async function _wtplusImageFramesGet() {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_FRAMES_FOR_PAGE",
          site: _site,
          book: _book,
          page: _page
        },
        resolve
      );
    });

    return response;
  }


  async function getFramesForProfile(wtId) {
    
  }


  async function addFrame(wtId, frame) {
    const info = _pageInfo ? null : archiveProvider.getReferenceFromPage();
console.log("Adding frame:", wtId, frame);
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "ADD_FRAME",
          site: _site, 
          book: _book, 
          page: _page,
          info: info, 
          wikitreeid: wtId,
          x: frame.x,
          y: frame.y, 
          w: frame.w, 
          h: frame.h,
          note: frame.note
        },
        resolve
      );
    });
    if (response?.error) {
      console.warn("Failed to add new frame:", {_site, _book, _page}, "Response:", response);
      return null;
    }
    if (info) _pageInfo = info;

    return response?.response?.frameid;
    
  }


  async function deleteFrame(wtId, frameId) {
    
  }


  window.wtplusAPI = {
    getFramesForPage,
    getPageReferrers,
    getFramesForProfile,
    addFrame,
    deleteFrame
  }

})();

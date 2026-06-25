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
      console.log(pageData);
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


  async function getFramesForProfile(site, wtId) {
    const key = `${site}|${wtId}`;
    if (!_profileCache.has(key)) {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "GET_FRAMES_FOR_PROFILE",
            site: site, 
            wtId: wtId
          },
          resolve
        );
      });
      
      if (response?.error) {
        console.warn("Failed to fetch frame data from WT+ API for", {site, wtId}, "Response:", response);
      }
      const profileData = response.response.profiles;
      _profileCache.set(key, profileData);
    }
    return _profileCache.get(key);
  }


  async function addFrame(wtId, frame) {
    const info = _pageInfo ? null : await archiveProvider.getReferenceFromPage();
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "ADD_FRAME",
          site: _site, 
          book: _book, 
          page: _page,
          info: info, 
          wikitreeid: wtId,
          frame: frame
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
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "DELETE_FRAME", 
          site: _site, 
          book: _book, 
          page: _page, 
          wikitreeid: wtId, 
          frameId: frameId
        },
        resolve
      );
    });
    if (response?.response?.success !== "OK") {
      console.warn("Failed to delete frame:", response);
      return null;
    }
    return (true);
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

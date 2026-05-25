(() => {
  "use strict";

  const id = "archiveOrg";

  let _currentViewport = null; 


  function waitForViewerReady() {
    
    if (_forceOneUpModeIfNeeded()) {
      return;
    }

    const interval = setInterval(() => {

      const page = document.querySelector(
        ".BRpage-visible"
      );

      if (!page) return;

      clearInterval(interval);

      initOverlay();

    }, 100);
  }


  function _forceOneUpModeIfNeeded() {

    if (location.pathname.includes("/mode/2up")) {

      location.href =
        location.href.replace(
          "/mode/2up",
          "/mode/1up"
        );

      return true;
    }

    return false;
  }


  function getViewerContainer() {
    return document.querySelector(
      ".BRpagecontainer"
    );
  }


  /**
   * Extracts page identifier from current URL
   * Used as the key for storing/loading annotations per page
   * @returns {string} Page key (e.g., "historymapofdanb00will_page152")
   */
  function getCurrentPageKey() {
    return getPageKey(window.location.href);
  }
  function getPageKey(href) {
    const book = href.match(/\/details\/([^/?#]+)/i);
    const page = href.match(/\/page\/([^/?#]+)/i);
    const match = book && page ? `${book[1]}_page${page[1]}` : null;
    return match ? match : "unknown";
  }


    /**
   * Grabs the page URL and strips off everything after the image ID
   * @returns {string} clean URL
   */
  function getCleanPageUrl() {
    const url = new URL(window.location.href);

    // remove everything after the base path
    url.hash = "";

    return url.origin + url.pathname;
  }


  function syncViewport() {

    // const page =
    //   document.querySelector(
    //     ".BRpage-visible"
    //   );

    // if (!page) return;

    // _currentViewport = page.getBoundingClientRect();
  }


  function initializeViewportTracking() {
  }


  function getCurrentViewport() {
    return _currentViewport;
  }


  function getReferenceFromPage(pageKey) {
  }


  const _provider = {
    waitForViewerReady,
    getViewerContainer,
    getCurrentPageKey,
    getReferenceFromPage,
    syncViewport,
    getCurrentViewport,
    getCleanPageUrl,
    initializeViewportTracking,
    id,
    getPageKey
  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);
  
})();
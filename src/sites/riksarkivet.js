(() => {
  "use strict";

  const site = "riksarkivet";

  let _currentViewport = null;

  let _firstViewportRenderDone = false;

  /**
   * Waits for OpenSeadragon container to load, then initializes overlay
   * Polls every 200ms until container is found
   */
  function waitForViewerReady() {
    const el = document.querySelector(".openseadragon-canvas");

    if (el) {
      _injectPageScript();
      initOverlay();
      return;
    }

    setTimeout(waitForViewerReady, 200);
  }


  function _injectPageScript() {
    if (document.getElementById("wta-riksarkivet-page-script")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "wta-riksarkivet-page-script";
    script.src = chrome.runtime.getURL("src/sites/riksarkivet-page.js");
    script.onload = () => script.remove();

    (document.head || document.documentElement).appendChild(script);


  }


  // get the OpenSeadragon container (the element the overlay should attach to)
  function getViewerContainer() {
    return document.querySelector(".openseadragon-canvas");
  }

  /**
   * Extracts page identifier from current URL
   * Used as the key for storing/loading annotations per page
   * @returns {site, book, page} 
   */
  function getCurrentPageKey() {
    return getPageKey(window.location.href);
  }
  function getPageKey(href) {
    let match = href.match(/\/bildvisning\/([^/?#]+)/i);
    let [book, page] = match[1]?.split("_") || [null, null];
    if (book === "Folk") {
      [book, page] = match[1]?.split("-") || [null, null];
    }
    return { site, book, page };
  }

  /**
   * Builds a URL from the passed in book and page
   */
  function buildUrlFromBookPage(book, page) {
    return (`https://sok.riksarkivet.se/bildvisning/${book}_${page}`);
  }

  /**
   * Extracts source reference text from page
   * @returns {string} source reference
   */
  async function getReferenceFromPage() {
    const items = document.querySelectorAll('.item');

    for (const item of items) {
      const valueEl = item.querySelector('.value');
      if (!valueEl) continue;

      const text = valueEl.innerText.trim();

      // Expand the text so we don't get a truncated version
      const expandLink =
        valueEl.querySelector('a.toggle.less');

      if (expandLink) {

        expandLink.click();

        await new Promise(r =>
          setTimeout(r, 50)
        );
      }

      // Must contain ID label in either language
      const hasIdLabel =
        /bildid:/i.test(text) || /image id:/i.test(text);

      if (!hasIdLabel) continue;

      // Re-read AFTER expansion
      const fullText =
        valueEl.innerText.trim();

      // Exclude simple fields (just ID or URL)
      const looksLikeCitation =
        fullText.includes(",") && fullText.length > 50;

      if (!looksLikeCitation) continue;

      const clone = valueEl.cloneNode(true);
      clone.querySelector('a.toggle')?.remove();

      return clone.innerText.trim();
    }
    return null;
  }


  /**
   * Syncs _currentViewport
   * Call when viewport changes
   */
  async function _syncViewport(viewport) {
    _currentViewport = viewport;
  }

  function getCurrentViewport() {
    return _currentViewport;
  }


  async function projectImagePoints(frameData) {
    const requestId = crypto.randomUUID();

    return new Promise((resolve) => {

      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.type !== "WT_PROJECT_IMAGE_POINTS_RESULT") return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener("message", onMessage);
        resolve(event.data.points);
      }

      window.addEventListener("message", onMessage);

      window.postMessage({
        type: "WT_PROJECT_IMAGE_POINTS",
        requestId,
        points: [
          {x: frameData.x, y: frameData.y},  // top-left
          {x: frameData.x + frameData.w, y: frameData.y},  // top-right
          {x: frameData.x + frameData.w, y: frameData.y + frameData.h},  // bottom-right
          {x: frameData.x, y: frameData.y + frameData.h}  // bottom-left
        ]
      });
    });
  }


  async function unprojectScreenPoints(screenFrameData) {
    return new Promise((resolve) => {
      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.type !== "WT_UNPROJECT_SCREEN_POINTS_RESULT") return;

        window.removeEventListener("message", onMessage);
        resolve(event.data.points);
      }

      window.addEventListener("message", onMessage);

      window.postMessage({
        type: "WT_UNPROJECT_SCREEN_POINTS",
        points: screenFrameData
      });
    })
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


  // Tracks viewport changes (pan/zoom/rotate) and re-renders annotations to maintain alignment
  function initializeViewportTracking() {

    window.addEventListener("message", e => {
      if (e.source !== window) return;

      if (e.data?.type === "RIKSARKIVET_VIEW_CHANGED") {
        _syncViewport(e.data.viewport);

        overlay.renderAnnotations();
      }
    });
  }


  const _provider = {
    waitForViewerReady,
    getViewerContainer,
    getCurrentPageKey,
    getReferenceFromPage,
    getCurrentViewport,
    getCleanPageUrl,
    initializeViewportTracking,
    site,
    getPageKey,
    buildUrlFromBookPage,
    projectImagePoints,
    unprojectScreenPoints
  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();
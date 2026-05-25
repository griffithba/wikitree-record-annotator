(() => {
  "use strict";

  const id = "digitalarkivet";

  let _currentViewport = null; // in image space coordinates, synced from URL hash

  let _firstViewportRenderDone = false;

  /**
   * Waits for OpenSeadragon container to load, then initializes overlay
   * Polls every 200ms until container is found
   */
  function waitForViewerReady() {
    const el = document.querySelector(".openseadragon-canvas");

    if (el) {
      initOverlay();
      syncViewport();
      return;
    }

    setTimeout(waitForViewerReady, 200);
  }

  // get the OpenSeadragon container (the element the overlay should attach to)
  function getViewerContainer() {
    return document.querySelector(".openseadragon-container");
  }

  /**
   * Extracts page identifier from current URL
   * Used as the key for storing/loading annotations per page
   * @returns {string} Page key (e.g., "P123_456")
   */
  function getCurrentPageKey() {
    return getPageKey(window.location.href);
  }
  function getPageKey(href) {
    const match = href.match(/\/source\/([^/?#]+)/i);
    console.log("getPageKey", href, match);
    return match ? match[1] : "unknown";
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
   * Parses IIIF xywh viewport from URL hash
   * @returns {{x, y, w, h}|null} Viewport in image space or null if not found
   */
  function _getViewport() {
    return {
      x: 0,
      y: 0,
      w: 1,
      h: 1
    };
  }

  /**
   * Syncs currentViewport from URL hash
   * Call before rendering to pick up any viewer pan/zoom changes
   */
  function syncViewport() {
    console.log("syncViewport");
    _currentViewport = _getViewport();
  }

  function getCurrentViewport() {
    console.log("getCurrentViewport", _currentViewport);
    return _currentViewport;
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

  // Tracks viewport changes (pan/zoom) and re-renders annotations to maintain alignment
  function initializeViewportTracking() {

    window.addEventListener(
      "hashchange",
      () => {
        overlay.renderAnnotations();

        if (!_firstViewportRenderDone) {

          ui.updateToolUI();

          _firstViewportRenderDone = true;
        }
      }
    );
  }

  //function matchesUrl(url) {
  //  return url.includes(id);
  //}

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
    //matchesUrl,   
    getPageKey
  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();
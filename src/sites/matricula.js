(() => {
  "use strict";

  const id = "matricula";
  let _currentViewport = null; 
  let _firstViewportRenderDone = false;
  let _resizeObserver = null;
  let _mutationObserver = null;
  let _renderAnimationFrameId = null;

  
  function _injectPageScript() {
    //return new Promise((resolve, reject) => {

      if (document.getElementById("wbe-matricula-page-script")) {
        return;
      }

      const script = document.createElement("script");
      script.id = "wbe-matricula-page-script";
      script.src = chrome.runtime.getURL("src/sites/matricula-page.js");
      script.onload = () => script.remove();

      (document.head || document.documentElement).appendChild(script);
    //});
  }

  function waitForViewerReady() {
    const container = document.querySelector(".ol-viewport");

    if (container) {
      _injectPageScript();
      initOverlay();
    }
    else setTimeout(waitForViewerReady, 200);
  }


  function getViewerContainer() {
    return document.querySelector(".ol-viewport");
  }

  
  function getCurrentPageKey() {
    return getPageKey(window.location.href);
  }
  

  function getPageKey(href) {
    try {
      const url = new URL(href);
      const params = new URLSearchParams(url.hash.replace("#", "?") || url.search);
      const id = params.get("id") || "";
      const page = params.get("page") || "1";
      return id ? `${id}_p${page}` : "unknown_matricula_page";
    } catch (e) {
      return "unknown_matricula_page";
    }
  }

  
  async function getReferenceFromPage() {
    const titleEl = document.querySelector(".page-header h1, #sidebar-metadata, .metadata-box");
    return titleEl ? titleEl.innerText.trim() : null;
  }

  
  /**
   * Syncs viewport geometries directly from OpenLayers internal variables.
   */
  function _syncViewport(viewState) {
    const container = document.querySelector(".ol-viewport");

    if (!container) {
      _currentViewport = null;
      return;
    }

    if (!viewState || !viewState.center) return;

    const viewWidth = container.clientWidth || window.innerWidth;
    const viewHeight = container.clientHeight || window.innerHeight;

    // OpenLayers minified variable translation mapping:
    const centerX = viewState.center[0];
    const centerY = viewState.center[1];
    const resolution = viewState.resolution; // units per pixel
    const rotation = viewState.rotation || 0;

    // Calculate total visible image span boundaries based on current resolution
    const halfWidthUnits = (viewWidth * resolution) / 2;
    const halfHeightUnits = (viewHeight * resolution) / 2;

    // OpenLayers defaults image-space cartesian math down into the negative quadrant.
    // We normalize these values into an absolute positive bounding array coordinate grid.
    const x = centerX - halfWidthUnits;
    const y = -centerY - halfHeightUnits;
    const w = viewWidth * resolution;
    const h = viewHeight * resolution;

    _currentViewport = { 
      x: Math.round(x), 
      y: Math.round(y), 
      w: Math.round(w), 
      h: Math.round(h),
      // Expose properties to handle rotation transforms natively inside _renderBox
      rotation: rotation 
    };

    //syncInteractionLayers();
  }
  function getCurrentViewport() {
    return _currentViewport;
  }

  
  function getCleanPageUrl() {
    const url = new URL(window.location.href);
    url.hash = "";
    return url.origin + url.pathname + url.search;
  }

  
  function initializeViewportTracking() {
    window.addEventListener("message", e => {
      if (e.source !== window) return;

      if (e.data?.type === "MATRICULA_VIEW_CHANGED") {
        _syncViewport(e.data.state);
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
    id,
    getPageKey
  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();

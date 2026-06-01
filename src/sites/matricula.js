(() => {
  "use strict";

  const id = "matricula";
  let _currentViewport = null; 
  let _firstViewportRenderDone = false;
  let _resizeObserver = null;
  let _mutationObserver = null;
  let _renderAnimationFrameId = null;

  
  /**
   * Defensive Scraper: Iterates through global scope structures to discover 
   * the unminified Matricula OpenLayers view state engine, even if the primary 
   * root variable name changes.
   */
  function getViewInstance() {
    // 1. Happy Path: Check the known standard wrapper first
    if (window.dv1 && window.dv1.b && window.dv1.b.view) {
      return window.dv1.b.view;
    }

    // 2. Dynamic Fallback Scraper: Deep search global object spaces
    // Only inspect top-level variables matching minified or application hashes
    const skipList = ["window", "document", "location", "top", "chrome", "Map", "Set"];
    
    for (const key in window) {
      if (skipList.includes(key) || key.startsWith("webpack") || key.startsWith("__")) continue;

      try {
        const rootObj = window[key];
        if (!rootObj || typeof rootObj !== "object") continue;

        // Matricula wraps the view controller deep inside their application controller object tree.
        // We traverse down possible nested objects to scan for the signature 'l' structure.
        for (const subKey in rootObj) {
          const subObj = rootObj[subKey];
          if (!subObj || typeof subObj !== "object") continue;

          // Check if this sub-object holds the 'view' structure
          const viewObj = subObj.view || subObj._view || subObj.mapView;
          if (viewObj && viewObj.l && "center" in viewObj.l && "resolution" in viewObj.l) {
            console.log(`🎯 Defensive Scraper successfully recovered hidden view module under parameter: window.${key}.${subKey}.view`);
            return viewObj;
          }
          
          // Direct double-check if the subObj itself is the view object
          if (subObj.l && "center" in subObj.l && "resolution" in subObj.l) {
             console.log(`🎯 Defensive Scraper successfully recovered hidden view module under parameter: window.${key}.${subKey}`);
             return subObj;
          }
        }
      } catch (e) {
        // Suppress cross-origin security context access block exceptions cleanly
      }
    }

    return null;
  }
  
  function waitForViewerReady() {
    const view = _getViewInstance();
    const container = document.querySelector(".ol-viewport");

    if (view && container) initOverlay();
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
  function syncViewport() {
    const view = _getViewInstance();
    const container = document.querySelector(".ol-viewport");
    
    if (!view || !container) {
      _currentViewport = null;
      return;
    }

    const viewState = view.l;
    if (!viewState || !viewState.center) return;

    const viewWidth = container.clientWidth || window.innerWidth;
    const viewHeight = container.clientHeight || window.innerHeight;

    // OpenLayers minified variable translation mapping:
    const centerX = state.$[0];
    const centerY = state.$[1];
    const resolution = state.L; // units per pixel
    const rotation = state.rotation || 0;

    // Calculate total visible image span boundaries based on current resolution
    const halfWidthUnits = (viewWidth * resolution) / 2;
    const halfHeightUnits = (viewHeight * resolution) / 2;

    // OpenLayers defaults image-space cartesian math down into the negative quadrant.
    // We normalize these values into an absolute positive bounding array coordinate grid.
    const x = centerX - halfWidthUnits;
    const y = Math.abs(centerY + halfHeightUnits); // Keep coordinates uniformly positive
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

    syncInteractionLayers();
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
    const vp = document.querySelector(".ol-viewport");

    const rerender = () => overlay.renderAnnotations();

    vp.addEventListener("pointerup", rerender);
    vp.addEventListener("wheel", rerender, { passive: true });

    new MutationObserver(rerender).observe(vp, {
      attributes: true,
      childList: true,
      subtree: true
    });
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

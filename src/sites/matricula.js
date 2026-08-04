(() => {
  "use strict";

  const site = "matricula";
  let _currentViewport = null; 

  let _currentViewerContainer = null;
  
  function _injectPageScript() {
      if (document.getElementById("wta-matricula-page-script")) {
        return;
      }

      const script = document.createElement("script");
      script.id = "wta-matricula-page-script";
      script.src = chrome.runtime.getURL("src/sites/matricula-page.js");
      script.onload = () => script.remove();

      (document.head || document.documentElement).appendChild(script);
  }


  /**
   * Waits for viewer container to load.
   * Polls every 200ms until container is found
   */
  function waitForViewerReady() {
    // If we're on something other than a record image page, bail out.
    if (!new URL(window.location.href).searchParams.has("pg")) {
      return Promise.resolve(false);
    }

    return new Promise(resolve => {
      function check() {
        const container = getViewerContainer();

        if (container) {
          _currentViewerContainer = container;
          _injectPageScript();
          resolve(true);
          return;
        }

        setTimeout(check, 200);
      }

      check();
    });
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
      // Pattern skips domain and the 2-letter language code, 
      // captures everything up to the trailing slash as the book, 
      // and captures the 'pg' query parameter via the standard URL api.
      const pathRegex = /^\/[a-z]{2}\/(.+?)\/?$/i;
      const match = url.pathname.match(pathRegex);
    
      if (match) {
        const book = match[1];
        const page = url.searchParams.get("pg") || "1";

        return { site, book, page };
      }
    } catch (e) {
      return "unknown_matricula_page";
    }
  }

  
  /**
   * Scrapes metadata directly from Matricula's structural table cells.
   * Operates independently of the active interface language.
   * @returns {string|null} The formatted reference citation string
   */
  async function getReferenceFromPage() {
    // Target rows inside the modal table component context frame
    const rows = document.querySelectorAll(".modal-body table.table tbody tr");
  
    // Ensure the table structure has the expected 5 data rows
    if (!rows || rows.length < 5) return null;

    try {
      // Extract text directly from the second cell (td) of each index position
      const parish = rows[0].querySelector("td")?.innerText.trim() || "";
      const identifier = rows[1].querySelector("td")?.innerText.trim() || "";
      const registerType = rows[2].querySelector("td")?.innerText.trim() || "";
      const dateStart = rows[3].querySelector("td")?.innerText.trim() || "";
      const dateEnd = rows[4].querySelector("td")?.innerText.trim() || "";

      if (parish && identifier && registerType && dateStart && dateEnd) {
        // Assemble formatting chain: Parish, Register type, Identifier, Date range start - Date range end
        return `${parish}, ${registerType}, ${identifier}, ${dateStart} - ${dateEnd}`;
      }
    } catch (e) {
      console.error("Failed to scrape reference layout matrix data cells:", e);
    }

    return null;
  }

  
  /**
   * Syncs viewport geometries directly from OpenLayers internal variables.
   */
  function _syncViewport(viewState) {
    const container = getViewerContainer();

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

    // Horizontal plane matches standard positive coordinate tracks
    const x = centerX - halfWidthUnits;
    // Because moving down scales into negative territory in Matricula's engine,
    // inverting centerY aligns the translation space to match standard positive browser dimensions.
    const y = -centerY - halfHeightUnits;
    // Viewport dimensions map linearly to resolution sizing matrices
    const w = viewWidth * resolution;
    const h = viewHeight * resolution;

    _currentViewport = { 
      x: Math.round(x), 
      y: Math.round(y), 
      w: Math.round(w), 
      h: Math.round(h),
      rotation: rotation * (180 / Math.PI)
    };

  }


  async function projectImagePoints(imagePoints) {
    const vp = _currentViewport;
    const rect = overlay.getOverlayElement().getBoundingClientRect();

    const screenFrameData = imagePoints.map(({x, y}) => {
      let ix = x;
      let iy = y;

      // 1. Re-apply viewer rotation (Forward rotation around the viewport center)
      if (vp.rotation) {
        // Use positive rotation angle to match the viewer's current state
        const theta = vp.rotation * Math.PI / 180;

        const cx = vp.x + vp.w / 2;
        const cy = vp.y + vp.h / 2;

        const dx = ix - cx;
        const dy = iy - cy;

        // Standard rotation matrix around the center
        ix = cx + dx * Math.cos(theta) - dy * Math.sin(theta);
        iy = cy + dx * Math.sin(theta) + dy * Math.cos(theta);
      }

      // 2. Convert viewport coordinates back to screen pixels
      // (Isolate 'x' and 'y' from your original algebraic formulas)
      const sx = ((ix - vp.x) / vp.w) * rect.width;
      const sy = ((iy - vp.y) / vp.h) * rect.height;

      return { x: sx, y: sy };
    });

    return screenFrameData;
  }


  async function unprojectScreenPoints(screenPoints) {
    const vp = _currentViewport;
    const rect = overlay.getOverlayElement().getBoundingClientRect();

    const imagePoints = screenPoints.map(({x, y}) => {

      // Convert screen pixel to viewport-relative coordinates
      let ix = vp.x + (x / rect.width) * vp.w;
      let iy = vp.y + (y / rect.height) * vp.h;

      // Undo viewer rotation
      if (vp.rotation) {

        const theta = -vp.rotation * Math.PI / 180;

        const cx = vp.x + vp.w / 2;
        const cy = vp.y + vp.h / 2;

        const dx = ix - cx;
        const dy = iy - cy;

        ix = cx + dx * Math.cos(theta) - dy * Math.sin(theta);
        iy = cy + dx * Math.sin(theta) + dy * Math.cos(theta);
      }

      return { x: ix, y: iy };
    });

    return imagePoints;
  }
  
  /**
   * Generates a clean URL string.
   * Explicitly preserves the page sequence parameter ('pg') while dropping 
   * the profile ID ('wtId').
   * @returns {string} Clean URL string
   */
  function getCleanPageUrl() {
    const url = new URL(window.location.href);
    
    // 1. Drop any temporary view layout hashes completely
    url.hash = ""; 

    // 2. Isolate and clean the active query parameter chain
    const originalParams = url.searchParams;
    const cleanParams = new URLSearchParams();

    // 3. Explicitly put back the pg parameter if it exists
    if (originalParams.has("pg")) {
      cleanParams.set("pg", originalParams.get("pg"));
    }

    // 4. Update the URL object with the scrubbed parameter profile
    url.search = cleanParams.toString();

    // Returns the fully sanitized destination string
    return url.toString();
  }
  

  function initializeViewportTracking() {
    window.addEventListener("message", e => {
      if (e.source !== window) return;

      if (e.data?.type === "MATRICULA_VIEW_CHANGED") {
        _syncViewport(e.data.state);

        const container = getViewerContainer();
        // If there's been a page change.
        if (_currentViewerContainer !== container) {
          _currentViewerContainer = container;
          const host = container.parentElement; 

          // Re-attach overlay layers to the new page's viewer container
          host.appendChild(overlay.getAnnotationLayerElement());
          host.appendChild(overlay.getOverlayElement());

          // Remove wtId from URL if present
          const url = new URL(window.location.href);

          if (url.searchParams.has("wtId")) {
            url.searchParams.delete("wtId");

            history.replaceState(
              history.state,
              "",
              url.toString()
            );
          }
        }
        overlay.renderAnnotations();        
      }
    });
  }

  
  const _provider = {
    waitForViewerReady,
    getViewerContainer,
    getReferenceFromPage,
    initializeViewportTracking,
    site,
    getPageKey,
    getCurrentPageKey,
    buildUrlFromBookPage: (book, page) => (`https://data.matricula-online.eu/${book}/?pg=${page}`),
    projectImagePoints,
    unprojectScreenPoints,
    getToolbarPosition: () => ({ top: "7px", left: "50%" })
  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();

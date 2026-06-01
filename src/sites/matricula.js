(() => {
  "use strict";

  const id = "matricula";
  let _currentViewport = null; 
  let _firstViewportRenderDone = false;
  let _resizeObserver = null;
  let _mutationObserver = null;
  let _renderAnimationFrameId = null;


  function waitForViewerReady() {
    const el = document.querySelector(".ol-viewport");
    console.log("Matricula viewer check:", !!el);
    if (el) initOverlay();
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

  function syncViewport() {
    _currentViewport = null;
  }

  function getCurrentViewport() {
    return null;
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

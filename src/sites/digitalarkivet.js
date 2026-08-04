(() => {
  "use strict";

  const openseadragon = window.openseadragon;
  
  const site = "digitalarkivet";

  let _permalinkPromise = null;


  function _injectPageScript() {
    if (document.getElementById("wta-digitalarkivet-page-script")) {
      return;
    }

    const osdScript = document.createElement("script");
    osdScript.id = "wta-openseadragon-page-script";
    osdScript.src = chrome.runtime.getURL("src/sites/openseadragon-page.js");

    osdScript.onload = () => {
      const siteScript = document.createElement("script");
      siteScript.id = "wta-digitalarkivet-page-script";
      siteScript.src = chrome.runtime.getURL("src/sites/digitalarkivet-page.js");
      siteScript.onload = () => siteScript.remove();

      (document.head || document.documentElement).appendChild(siteScript);

      osdScript.remove();
    };

    (document.head || document.documentElement).appendChild(osdScript);
  }


  /**
   * Extracts page identifier from permalink on current page, not URL.
   * Used as the key for storing/loading annotations per page
   * @returns {string} Page key (e.g., "P123_456")
   */
  async function getCurrentPageKey() {

    const link = await _getPermalink();

    const key = getPageKey(link);
    if (!key) return null;
    key.book = _getCurrentBook();

    return key;
  }

  function getPageKey(link) {
    if (!link) return null;

    const match = link.pathname.match(/^\/(kb\d+)$/i);

    if (!match) return null;

    return {
      site,
      book: null,
      page: match[1]
    };
  }


  async function _getPermalink() {
    if (_permalinkPromise) {
      return _permalinkPromise;
    }

    _permalinkPromise = _findPermalink();

    try {
      return await _permalinkPromise;
    } finally {
      _permalinkPromise = null;
    }
  }


  async function _findPermalink() {
    const button = document.querySelector(
      'button[aria-label="Lenker"]'
    );

    if (!button) return null;

    const wasExpanded =
      button.getAttribute("aria-expanded") === "true";

    if (!wasExpanded) {
      button.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const link = document.querySelector(
      'a[href^="https://goto.digitalarkivet.no/"]'
    );

    return link ? new URL(link.href) : null;
  }

  function _getCurrentBook() {
    const labels = document.querySelectorAll("div");

    for (const label of labels) {
      if (label.textContent.trim() === "Arkivreferanse") {
        return label.nextElementSibling?.textContent.trim() ?? null;
      }
    }

    return null;
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

      const reference = clone.innerText.trim();
  console.log("getReferenceFromPage", reference);
      return(reference);
    }
    return null;
  }


  const _provider = {
    waitForViewerReady: () => openseadragon.waitForViewerReady(_injectPageScript),
    getViewerContainer: openseadragon.getViewerContainer,
    getCurrentPageKey,
    getPageKey,
    getReferenceFromPage,
    initializeViewportTracking: openseadragon.initializeViewportTracking,
    site,
    projectImagePoints: openseadragon.projectImagePoints,
    unprojectScreenPoints: openseadragon.unprojectScreenPoints

  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();

(() => {
  "use strict";

  const site = "riksarkivet";

  const openseadragon = window.openseadragon;


  function _injectPageScript() {
    if (document.getElementById("wta-riksarkivet-page-script")) {
      return;
    }

    const osdScript = document.createElement("script");
    osdScript.id = "wta-openseadragon-page-script";
    osdScript.src = chrome.runtime.getURL("src/sites/openseadragon-page.js");

    osdScript.onload = () => {
      const siteScript = document.createElement("script");
      siteScript.id = "wta-riksarkivet-page-script";
      siteScript.src = chrome.runtime.getURL("src/sites/riksarkivet-page.js");
      siteScript.onload = () => siteScript.remove();

      (document.head || document.documentElement).appendChild(siteScript);

      osdScript.remove();
    };

    (document.head || document.documentElement).appendChild(osdScript);
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
    if (!match) return { status: "not-applicable" };
    let [book, page] = match[1]?.split("_") || [null, null];
    if (!book || !page) return { status: "not-applicable" };
    if (book === "Folk") {
      [book, page] = match[1]?.split("-") || [null, null];
      if (!book || !page) return { status: "not-applicable" };
    }
    return { status: "valid", site, book, page };
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
   * Grabs the page URL and strips off everything after the image ID
   * @returns {string} clean URL
   */
  function getCleanPageUrl() {
    const url = new URL(window.location.href);

    // remove everything after the base path
    url.hash = "";

    return url.origin + url.pathname;
  }


  const _provider = {
    site,
    getReferenceFromPage,
    getPageKey,
    getCurrentPageKey,
    buildUrlFromBookPage: (book, page) => (`https://sok.riksarkivet.se/bildvisning/${book}_${page}`)
  };

  if (window.openseadragon) {
    _provider.waitForViewerReady = () => openseadragon.waitForViewerReady(_injectPageScript);
    _provider.getViewerContainer = openseadragon.getViewerContainer;
    _provider.initializeViewportTracking = openseadragon.initializeViewportTracking;
    _provider.projectImagePoints = openseadragon.projectImagePoints;
    _provider.unprojectScreenPoints = openseadragon.unprojectScreenPoints;
  }

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();
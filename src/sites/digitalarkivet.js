/*  This is copied from riksarkivet.js with a few changes. It's not working yet. Image coordinates aren't in the URL like with RA, so they'll 
 *  have to be pulled from OpenSeadragon. The URL doesn't change on pan/zoom, so another mechanism will be needed for triggering re-rendering 
 *  the annotations. The link that's saved for citations redirects to something different. Page keys should be taken from the permalink, not 
 *  the one that it redirects to, in order for the WikiTree side of the extension to be able to highlight annotated sources and suggest 
 *  citations. Attaching the WT ID to the URL to enable annotation highlighting and pre-filling of the WT ID on a new annotation may not work, 
 *  since the URL redirect will probably cause the attached WT ID to be dropped.  
 */

(() => {
  "use strict";

  const openseadragon = window.openseadragon;
  
  const id = "digitalarkivet";

  /**
   * Waits for OpenSeadragon container to load, then initializes overlay
   * Polls every 200ms until container is found
   */
  function waitForViewerReady() {
    const container = openseadragon.getViewerContainer();

    if (container) {
      _injectPageScript();
      initOverlay();
      return;
    }

    setTimeout(waitForViewerReady, 200);
  }


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

      const reference = clone.innerText.trim();
  console.log("getReferenceFromPage", reference);
      return(reference);
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
    waitForViewerReady,
    getViewerContainer: openseadragon.getViewerContainer,
    getCurrentPageKey,
    getReferenceFromPage,
    getCleanPageUrl,
    initializeViewportTracking: openseadragon.initializeViewportTracking,
    id,
    getPageKey,
    projectImagePoints: openseadragon.projectImagePoints,
    unprojectScreenPoints: openseadragon.unprojectScreenPoints

  };

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();

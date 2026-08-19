(() => {
  "use strict";

  const openseadragon = window.openseadragon;
  
  const site = "digitalarkivet";

  let _permalinkPromise = null;

  /**
   * Digitalarkivet Record Viewer Mapping
   * true  = Supported by the New Image Viewer (ny bildeviser)
   * false = Legacy Image Viewer Only (gammel bildeviser)
   */
  const DIGITALARKIVET_VIEWER_MAP = Object.freeze({
    // --- NEW VIEWER CHANNELS ---
    kb: true,   // Kirkebøker (Parish / Church Registers)
    em: true,   // Emigrasjon (Emigration & Passenger Lists)
  
    // --- OLD LEGACY VIEWER ONLY (Awaiting Migration) ---
    tl: false,  // Tinglysing (Land Registry / Real Estate Books)
    ft: false,  // Folketellinger (National Population Censuses)
    sk: false,  // Skifteprotokoller (Probate and Inheritances)
    pa: false,  // Privatarkiver (Private Business/Org Archives)
    sa: false,  // Statlige arkiver (State & Ministerial Records)
    rg: false,  // Rettergang (Court Journals & Litigation logs)
    po: false,  // Politi og lensmenn (Historical Police Records)
    pr: false,  // Protokoller (General Administrative Logs)
    db: false   // Dombøker / Riksarkivets diplomsamling (Medieval Diplomas)
  });

  /**
   * Determines if a given Digitalarkivet 16-character code uses the new viewer.
   * @param {string} rawId - The tracking ID (e.g., "kb20070614610123")
   * @returns {boolean} - true if new viewer, false if old or unrecognized.
   */
  function isNewViewerRecord(rawId) {
    if (typeof rawId !== 'string' || rawId.length < 2) {
      return false;
    }
    const prefix = rawId.slice(0, 2).toLowerCase();

    // Missing or unknown codes default to false (legacy viewer fallback)
    return DIGITALARKIVET_VIEWER_MAP[prefix] ?? false;
  }


  // Wrapper for openseadragon.waitForViewerReady that handles the old viewer case
  async function waitForViewerReady() {
    if (await _outdatedLink()) {
      await _handleOldViewer();
      return false;
    }

    return openseadragon.waitForViewerReady(_injectPageScript);
  }


  async function _outdatedLink() {
    const url = new URL(window.location.href);

    if (url.hostname === "media.digitalarkivet.no") {
      const permalink = document.querySelector("#reader_link")?.value;

      const keyStruct = await getPageKey(permalink);

      if (keyStruct && isNewViewerRecord(keyStruct?.page)) {
        return true;
      }
    }

    return false;
  }


  async function _handleOldViewer() {
    const quickLink = document.querySelector("#reader_link")?.value;

    if (!quickLink) {
      console.warn("Digitalarkivet old viewer: Quick Link not found.");
      return;
    }

    let newViewerUrl;

    try {
      const url = new URL(quickLink);

      newViewerUrl = url.href;
    } catch (e) {
      console.error(
        "Digitalarkivet old viewer: invalid Quick Link:",
        quickLink,
        e
      );
      return;
    }

    // Create the modal.
    const overlay = document.createElement("div");

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "rgba(0, 0, 0, 0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    });

    const dialog = document.createElement("div");

    Object.assign(dialog.style, {
      background: "white",
      color: "#222",
      width: "min(520px, calc(100vw - 40px))",
      padding: "24px",
      borderRadius: "8px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
      fontFamily: "Arial, sans-serif",
      lineHeight: "1.5"
    });

    const title = document.createElement("h2");
    title.textContent = "Digitalarkivet link needs updating";
    title.style.margin = "0 0 16px";

    const message = document.createElement("p");
    message.textContent =
      "The link you followed uses Digitalarkivet's old image viewer. " +
      "The WikiTree Record Annotator only works with the new viewer. " +
      "Please consider updating the link in the WikiTree profile so that it points to the new viewer.";

    const linkLabel = document.createElement("p");
    linkLabel.textContent = "New viewer link:";
    linkLabel.style.marginBottom = "4px";

    const link = document.createElement("a");
    link.href = newViewerUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = newViewerUrl;
    link.style.wordBreak = "break-all";

    const buttons = document.createElement("div");

    Object.assign(buttons.style, {
      display: "flex",
      gap: "12px",
      justifyContent: "flex-end",
      marginTop: "24px"
    });

    const openButton = document.createElement("a");
    openButton.href = newViewerUrl;
    openButton.target = "_blank";
    openButton.rel = "noopener noreferrer";
    openButton.textContent = "Open new viewer";

    Object.assign(openButton.style, {
      padding: "8px 14px",
      background: "#1769aa",
      color: "white",
      textDecoration: "none",
      borderRadius: "4px"
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Stay here";

    Object.assign(closeButton.style, {
      padding: "8px 14px",
      border: "1px solid #aaa",
      background: "white",
      borderRadius: "4px",
      cursor: "pointer"
    });

    closeButton.addEventListener("click", () => {
      overlay.remove();
    });

    buttons.append(closeButton, openButton);

    dialog.append(
      title,
      message,
      linkLabel,
      link,
      buttons
    );

    overlay.append(dialog);
    document.body.append(overlay);

    // Allow Escape to dismiss the dialog.
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", handleKeyDown);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
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
   * Extracts page identifier from permalink on current page, not URL.
   * Used as the key for storing/loading annotations per page
   * @returns {string} Page key (e.g., "P123_456")
   */
  async function getCurrentPageKey() {

    const link = await _getPermalink();

    const key = getPageKey(link.href);
    if (!key) return null;
    key.book = _getCurrentBook();

    return key;
  }

  function getPageKey(link) {
    if (!link) return null;
    const parsed = new URL(link);

    if (parsed.hostname === "nye.digitalarkivet.no") {
      return { status: "needs-fix" };
    }

    const match = parsed.pathname.match(/^\/([a-z]{2}\d{14})$/);

    if (!match) {
      if (parsed.hostname === "media.digitalarkivet.no") return { status: "needs-fix" };
      return { status: "not-applicable" };
    }

    return {
      status: "valid",
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

    if (!wasExpanded) {
      button.click();
    }
    
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
    const labels = document.querySelectorAll("div.text-label");

    let archive = "";
    let archiveVolume = "";
    let timePeriod = "";

    for (const label of labels) {
      const name = label.innerText.trim();
      const value = label.nextElementSibling?.innerText.trim() || "";

      switch (name) {
        case "Arkiv":
          archive = value;
          break;

        case "Arkivstykke/Arkivmappe":
          archiveVolume = value;
          break;

        case "Tidsrom":
          timePeriod = value;
          break;
      }
    }

    if (!archive || !archiveVolume) return null;

    const parts = [
      archive,
      archiveVolume,
      timePeriod ? `(${timePeriod})` : "" 
    ].filter(Boolean);

    const referenceString = parts.join(", ");
console.log("Reference string:", referenceString);
    return referenceString;
  }


  const _provider = {
    site,
    waitForViewerReady,
    getCurrentPageKey,
    getPageKey,
    getReferenceFromPage
  };

  if (window.openseadragon) {
    _provider.getViewerContainer = openseadragon.getViewerContainer;
    _provider.initializeViewportTracking = openseadragon.initializeViewportTracking;
    _provider.projectImagePoints = openseadragon.projectImagePoints;
    _provider.unprojectScreenPoints = openseadragon.unprojectScreenPoints;
  }

  window.archiveProviders ??= [];
  window.archiveProviders.push(_provider);

})();


let sourceSite = "riksarkivet";

/**
 * Waits for OpenSeadragon container to load, then initializes overlay
 * Polls every 200ms until container is found
 */
function waitForViewerReady() {
  const el = document.querySelector(".openseadragon-canvas");

  if (el) {
    initOverlay();
    return;
  }

  setTimeout(waitForOSDContainer, 200);
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
function getPageKey() {
  const match = window.location.href.match(/([A-Z]\d+_\d+)/);
  return match ? match[1] : "unknown";
}

/**
 * Extracts source reference text from page
 * @returns {string} source reference
 */
function getReferenceFromPage() {
  const items = document.querySelectorAll('.item');

  for (const item of items) {
    const valueEl = item.querySelector('.value');
    if (!valueEl) continue;

    const text = valueEl.innerText.trim();

    // Must contain ID label in either language
    const hasIdLabel =
      /bildid:/i.test(text) || /image id:/i.test(text);

    if (!hasIdLabel) continue;

    // Exclude simple fields (just ID or URL)
    const looksLikeCitation =
      text.includes(",") && text.length > 50;

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
function getViewportFromUrl() {
  const hash = window.location.hash;
  const query = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(query);
  const xywh = params.get("xywh");

  if (!xywh) return null;

  const [x, y, w, h] = xywh.split(",").map(Number);
  return { x, y, w, h };
}

/**
 * Syncs currentViewport from URL hash
 * Call before rendering to pick up any viewer pan/zoom changes
 */
function syncViewport() {
  currentViewport = getViewportFromUrl();
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
  const originalReplaceState = history.replaceState;

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);

    requestAnimationFrame(() => {
      renderAnnotations();
    });

    return result;
  };

  window.addEventListener("popstate", renderAnnotations);
}


// File: WikiTree Overlay Annotation Tool
// Allows drawing annotation boxes that stay aligned during
// zoom and pan by storing coordinates in image space (xywh).

// ============================================================
// INITIALIZATION & DOM SETUP
// ============================================================
const storageAPI = window.storageAPI;
const personAPI = window.personAPI;
const theme = window.theme;
const ui = window.ui;
const tools = window.tools;
const overlay = window.overlay;
const annotationsAPI = window.annotationsAPI;
const archiveProvider = window.archiveProviders[0]; // make sure only one provider is listed in manifest.json per site

if (window.__wtOverlayInitialized) {
  console.log("WikiTree overlay already initialized");
} else {
  window.__wtOverlayInitialized = true;

  archiveProvider.waitForViewerReady();
}

let incomingWtId = null;         // ID from incoming WikiTree profile (if navigated from one)
let preFillWtIdOnCreate = false; // flag to pre-fill the editor with the incoming WikiTree profile ID on annotation creation

/**
 * Extracts WikiTree ID from URL search params (from incoming profile)
 * @returns {string|null} WikiTree ID or null
 */
function getWtIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("wtId");
}


// ============================================================
// INITIALIZATION & STARTUP
// ============================================================

/**
 * Initializes annotation overlay on page load
 * Sets up DOM, event listeners, toolbar, etc.
 */
function initOverlay() {
  if (window.__wtOverlayDomInitialized) {
    console.log("Overlay DOM already initialized");
    return;
  }

  window.__wtOverlayDomInitialized = true;

  // Get incoming WikiTree profile ID if present
  incomingWtId = getWtIdFromUrl();

  // Set flag to pre-fill the editor with the incoming WikiTree profile ID
  if (incomingWtId) preFillWtIdOnCreate = true;
    
  overlay.initialize(archiveProvider.getViewerContainer());

  overlay.createLayers();
  overlay.attachEvents();
  
  // Create the WikiTree annotation toolbar
  ui.createToolbar();
  
  // Create editor dialog
  ui.createWtEditor();
  
  // Align viewport and initialize tracking 
  archiveProvider.initializeViewportTracking();

  // Inject CSS styles
  theme.injectStyles();

}


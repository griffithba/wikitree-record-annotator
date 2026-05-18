// File: WikiTree Overlay Annotation Tool
// Allows drawing annotation boxes that stay aligned during
// zoom and pan by storing coordinates in image space (xywh).

if (window.__wtOverlayInitialized) {
  console.log("WikiTree overlay already initialized");
} else {
  window.__wtOverlayInitialized = true;

  waitForViewerReady();
}

// ============================================================
// SECTION 1: INITIALIZATION & DOM SETUP
// ============================================================
const storageAPI = window.storageAPI;
const personAPI = window.personAPI;
const theme = window.theme;
const ui = window.ui;
const tools = window.tools;
const overlay = window.overlay;
const annotationsAPI = window.annotationsAPI;

// ============================================================
// SECTION 2: STATE MANAGEMENT
// ============================================================
// Core state variables organized by purpose


// Drawing/drag state for box creation
let isDragging = false;               // Currently drawing a box
let startX = 0, startY = 0;          // Box start (in overlay pixels)
let endX = 0, endY = 0;              // Box end (in overlay pixels)
let box = null;                       // Temporary DOM element while dragging

// Tool and interaction state

// ID from incoming WikiTree profile (if navigated from one)
let incomingWtId = null;

// Whether to pre-fill the WtId editor with the incoming WtId on creation
let preFillWtIdOnCreate = false;

// Track which annotations have been highlighted already
const highlightedAnnotations = new Set();

// Resize state (when dragging resize handles)
let resizing = null;



// ============================================================
// SECTION 4: UTILITY HELPERS
// ============================================================
// Pure helper functions without side effects


/**
 * Extracts WikiTree ID from URL search params (from incoming profile)
 * @returns {string|null} WikiTree ID or null
 */
function getWtIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("wtId");
}


/**
 * Builds HTML title/tooltip for an annotation
 * Format: "Name (birth-death)" or WikiTree ID
 * @param {Object} a - Annotation object
 * @returns {string} Tooltip text
 */
function buildTooltip(a) {
  let text = a.wtId;

  if (a.wtIdFound) {
    const person = personAPI.getCached(a.wtId);

    if (person && (person.name || person.birth || person.death)) {
      const years = (person.birth || "") + "-" + (person.death || "");
      text = `${person.name || a.wtId} (${years})`;
    }
  } else {
    text += " not found";
  }
    
  if (a.note) {
    text += "\n" + a.note;
  }
    
  return text; 
}



// ============================================================
// SECTION 8: RESIZING ANNOTATION BOXES
// ============================================================

/**
 * Creates corner resize handles (nw, ne, sw, se) on selected box
 * @param {HTMLElement} box - Annotation box DOM element
 * @param {string} id - Annotation ID
 */
function addResizeHandles(box, id) {
  const corners = ["nw", "ne", "sw", "se"];

  corners.forEach(corner => {
    const handle = document.createElement("div");
    handle.className = `resize-handle ${corner}`;
    handle.dataset.corner = corner;

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      startResize(e, box, corner);
    });

    box.appendChild(handle);
  });
}

/**
 * Initiates resize drag from a handle
 * Saves initial state and sets up event listeners
 * @param {MouseEvent} e - mousedown event
 * @param {HTMLElement} boxEl - Annotation box element
 * @param {string} corner - Corner identifier (nw|ne|sw|se)
 */
function startResize(e, boxEl, corner) {
  const id = boxEl.dataset.annotationId;
  const annotation = annotationsAPI.getAnnotationById(id);
  if (!annotation) return;

  const boxIndex = Number(boxEl.dataset.boxIndex);
  const box = annotation.boxes[boxIndex];

  const rect = overlay.getBoundingClientRect();
  
  resizing = {
    id,
    boxIndex,
    corner,
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
    startBox: { ...box }  // Save original for delta calculations
  };

  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup", stopResize);
}

/**
 * Handles mousemove during resize drag
 * Converts screen deltas to image space and updates box dimensions
 * @param {MouseEvent} e - mousemove event
 */
function onResizeMove(e) {
  if (!resizing) return;

  const rect = overlay.getBoundingClientRect();
  const vp = currentViewport;

  // STEP 1: Compute mouse delta in overlay (screen) space
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  const dx = currentX - resizing.startX;
  const dy = currentY - resizing.startY;

  // STEP 2: Convert delta to image space
  // The scale factor relates overlay pixels to image coordinates
  const scaleX = vp.w / rect.width;
  const scaleY = vp.h / rect.height;

  const dxImg = dx * scaleX;
  const dyImg = dy * scaleY;

  // STEP 3: Apply delta to annotation box in image space
  const annotation = getAnnotationById(resizing.id);
  if (!annotation) return;

  const box = annotation.boxes[resizing.boxIndex];

  // Start from original coordinates
  let { x, y, w, h } = resizing.startBox;
  const corner = resizing.corner;

  // Apply resize based on which corner is being dragged
  if (corner.includes("e")) w += dxImg;      // East: expand width
  if (corner.includes("s")) h += dyImg;      // South: expand height
  if (corner.includes("w")) {                // West: move left edge
    x += dxImg;
    w -= dxImg;
  }
  if (corner.includes("n")) {                // North: move top edge
    y += dyImg;
    h -= dyImg;
  }

  // Normalize negative sizes (when dragging past opposite corner)
  if (w < 0) {
    x = x + w;
    w = Math.abs(w);
  }

  if (h < 0) {
    y = y + h;
    h = Math.abs(h);
  }

  // Enforce minimum box size
  w = Math.max(20, w);
  h = Math.max(20, h);

  // Update box coordinates
  box.x = x;
  box.y = y;
  box.w = w;
  box.h = h;

  overlay.renderAnnotations();
}

/**
 * Finalizes resize drag and saves changes
 */
function stopResize() {
  if (!resizing) return;

  annotationsAPI.saveAnnotationsForPage();

  resizing = null;

  document.removeEventListener("mousemove", onResizeMove);
  document.removeEventListener("mouseup", stopResize);
}



// ============================================================
// SECTION 13: REFERENCE HIGHLIGHTING
// ============================================================

/**
 * Triggers pulse animation on annotation if it matches incoming WT profile
 * Only highlights each annotation once, not on every re-render
 * @param {string} annotationId - Annotation ID
 */
function triggerRefHighlight(annotationId) {
  // Only highlight once per session
  if (highlightedAnnotations.has(annotationId)) return; 

  function start() {
    highlightedAnnotations.add(annotationId);

    // Highlight ALL boxes for this annotation
    requestAnimationFrame(() => {
      document.querySelectorAll(
        `[data-annotation-id="${annotationId}"]`
      ).forEach(box => {
        box.classList.add("wt-ref-highlight");
      });
    });
  }

  // If tab is visible, highlight immediately
  if (document.visibilityState === "visible") {
    start();
  } else {
    // Tab in background: wait for it to become visible
    const onVisible = () => {
      document.removeEventListener("visibilitychange", onVisible);
      start();
    };

    document.addEventListener("visibilitychange", onVisible);
  }
}


// ============================================================
// SECTION 14: INITIALIZATION & STARTUP
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
    
  overlay.initialize(getViewerContainer());

  overlay.createLayers();
  overlay.attachEvents();
  
  // Create the WikiTree annotation toolbar
  ui.createToolbar();
  
  // Create editor dialog
  ui.createWtEditor();
  
  // Align viewport and initialize tracking 
  initializeViewportTracking();

  // Inject CSS styles
  theme.injectStyles();

  /*
  // Load seed data if empty, then render
  seedCurrentPageIfEmpty().then(() => {
    requestAnimationFrame(() => {
      overlay.renderAnnotations();
      ui.updateToolUI();
    });
  });
  */

}

/**
 * Seeds page with sample annotations on first visit
 * Only does this if annotations array is empty
 */ /*
async function seedCurrentPageIfEmpty() {
  await annotationsAPI.loadAnnotationsIfNeeded();

  if (!annotations || annotations.length === 0) {
    const pageKey = getCurrentPageKey();
    annotations = sampleAnnotations.filter(a => a.page === pageKey);

    await annotationsAPI.saveAnnotationsForPage();
  }
}
  */

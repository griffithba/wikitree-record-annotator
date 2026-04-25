// ============================================================
// WikiTree Overlay Annotation Tool (IIIF / OpenSeadragon)
// ------------------------------------------------------------
// Allows drawing annotation boxes that stay aligned during
// zoom and pan by storing coordinates in image space (xywh).
// ============================================================


// --- DOM ELEMENTS -------------------------------------------------

// Transparent interaction layer (captures mouse input)
const overlay = document.createElement("div");
overlay.id = "wt-overlay";

// Visual layer for rendered annotations
const annotationLayer = document.createElement("div");

// Mode indicator (top-right UI)
const modeIndicator = document.createElement("div");


// --- STATE --------------------------------------------------------

let container = null;          // OSD container element
let currentViewport = null;    // {x,y,w,h} from URL (image space)

let annotations = [];          // stored in IMAGE SPACE

// Drag state
let isDragging = false;
let startX = 0, startY = 0;
let endX = 0, endY = 0;
let box = null;

// Mode state
let drawMode = false;
let keyListenerAdded = false;


// ============================================================
// MODE CONTROL
// ============================================================

function setDrawMode(enabled) {
  drawMode = enabled;

  overlay.style.pointerEvents = enabled ? "auto" : "none";
  overlay.style.cursor = enabled ? "crosshair" : "default";

  modeIndicator.textContent = enabled ? "DRAW MODE" : "NAV MODE";
  modeIndicator.style.background = enabled
    ? "rgba(180, 0, 0, 0.75)"
    : "rgba(0, 0, 0, 0.7)";
}


// ============================================================
// MOUSE HANDLERS (DRAWING)
// ============================================================

function onMouseDown(e) {
  if (!drawMode || !container) return;

  e.preventDefault();
  e.stopPropagation();

  isDragging = true;

  const rect = overlay.getBoundingClientRect();

  // Starting point in overlay pixel space
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  // Create temporary drag box
  box = document.createElement("div");
  box.style.position = "absolute";
  box.style.border = "2px dashed red";
  box.style.background = "rgba(25, 0, 255, 0.1)";
  box.style.pointerEvents = "none";

  annotationLayer.appendChild(box);
}

function onMouseMove(e) {
  if (!drawMode || !isDragging || !box) return;

  e.preventDefault();
  e.stopPropagation();

  const rect = overlay.getBoundingClientRect();

  // Current mouse position in overlay space
  endX = e.clientX - rect.left;
  endY = e.clientY - rect.top;

  // Normalize for drawing direction (works in all directions)
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  box.style.left = left + "px";
  box.style.top = top + "px";
  box.style.width = width + "px";
  box.style.height = height + "px";
}

function onMouseUp(e) {
  if (!drawMode || !isDragging || !box) return;

  e.preventDefault();
  e.stopPropagation();

  isDragging = false;

  const overlayRect = overlay.getBoundingClientRect();
  const vp = currentViewport;
  if (!vp) return;

  // Convert overlay pixels → normalized → IMAGE SPACE
  const x1 = vp.x + (startX / overlayRect.width) * vp.w;
  const y1 = vp.y + (startY / overlayRect.height) * vp.h;
  const x2 = vp.x + (endX / overlayRect.width) * vp.w;
  const y2 = vp.y + (endY / overlayRect.height) * vp.h;

  // Normalize rectangle in IMAGE SPACE
  const annotation = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1)
  };

  annotations.push(annotation);

  renderAnnotations();

  box.remove();
  box = null;
}


// ============================================================
// VIEWPORT (IIIF xywh FROM URL HASH)
// ============================================================

function getViewportFromUrl() {
  const hash = window.location.hash;
  const query = hash.startsWith("#") ? hash.slice(1) : hash;

  const params = new URLSearchParams(query);
  const xywh = params.get("xywh");

  if (!xywh) return null;

  const [x, y, w, h] = xywh.split(",").map(Number);
  return { x, y, w, h };
}

function syncViewport() {
  currentViewport = getViewportFromUrl();
}


// ============================================================
// RENDERING
// ============================================================

function renderAnnotations() {
  if (!container) return;

  // Always sync before rendering (prevents lag)
  syncViewport();

  const vp = currentViewport;
  if (!vp) return;

  const rect = container.getBoundingClientRect();

  // Clear previous render
  annotationLayer.innerHTML = "";

  annotations.forEach(a => {
    // IMAGE SPACE → viewport-relative → screen pixels
    const relX = (a.x - vp.x) / vp.w;
    const relY = (a.y - vp.y) / vp.h;
    const relW = a.w / vp.w;
    const relH = a.h / vp.h;

    const box = document.createElement("div");

    box.style.position = "absolute";
    box.style.left = (relX * rect.width) + "px";
    box.style.top = (relY * rect.height) + "px";
    box.style.width = (relW * rect.width) + "px";
    box.style.height = (relH * rect.height) + "px";

    box.style.border = "2px solid lime";
    box.style.background = "rgba(0,255,0,0.1)";
    box.style.pointerEvents = "none";

    annotationLayer.appendChild(box);
  });
}


// ============================================================
// INITIALIZATION
// ============================================================

function initOverlay() {
  container = document.querySelector(".openseadragon-container");
  if (!container) return;

  // Ensure proper positioning context
  container.style.position = "relative";

  // Annotation layer (visual only)
  Object.assign(annotationLayer.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none"
  });

  // Overlay (interaction layer)
  Object.assign(overlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "99999",
    cursor: "default",
    pointerEvents: "none"
  });

  // Mode indicator UI
  Object.assign(modeIndicator.style, {
    position: "fixed",
    top: "10px",
    right: "10px",
    zIndex: "100000",
    padding: "6px 10px",
    fontSize: "12px",
    fontFamily: "sans-serif",
    background: "rgba(0,0,0,0.7)",
    color: "white",
    borderRadius: "6px",
    pointerEvents: "none"
  });

  modeIndicator.textContent = "NAV MODE";
  document.body.appendChild(modeIndicator);

  // Attach mouse events
  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);

  // Insert layers (order matters)
  container.appendChild(annotationLayer);
  container.appendChild(overlay);

  // Keyboard toggle (press "t")
  if (!keyListenerAdded) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "t") {
        setDrawMode(!drawMode);
      }
    });
    keyListenerAdded = true;
  }

  setDrawMode(false);

  // Keep viewport synced
  syncViewport();
  let lastHash = "";

  setInterval(() => {
    if (window.location.hash !== lastHash) {
      lastHash = window.location.hash;
      renderAnnotations();
    }
  }, 50);
}


// ============================================================
// WAIT FOR VIEWER
// ============================================================

function waitForOSDContainer() {
  const el = document.querySelector(".openseadragon-canvas");

  if (el) {
    initOverlay();
    return;
  }

  setTimeout(waitForOSDContainer, 200);
}

waitForOSDContainer();


console.log("WikiTree overlay with drag enabled");

/*document.addEventListener("mousedown", (e) => {
  console.log("GLOBAL mousedown");
}, true);

console.log("OSD:", window.OpenSeadragonImaging);
*/

// --- Create overlay ---
let overlay = document.createElement("div");
overlay.id = "wt-overlay";
overlay.style.position = "absolute";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.zIndex = "99999";
overlay.style.cursor = "crosshair";
overlay.style.background = "rgba(255,0,0,0.1)"; // light tint so you can see it
overlay.style.border = "3px solid red";
overlay.style.pointerEvents = "auto";

let viewerRect = null;

// --- Create pointer mode indicator ---
let modeIndicator = document.createElement("div");

modeIndicator.id = "wt-mode-indicator";
modeIndicator.textContent = "NAV MODE";

modeIndicator.style.position = "fixed";
modeIndicator.style.top = "10px";
modeIndicator.style.right = "10px";
modeIndicator.style.zIndex = "100000";
modeIndicator.style.padding = "6px 10px";
modeIndicator.style.fontSize = "12px";
modeIndicator.style.fontFamily = "sans-serif";
modeIndicator.style.background = "rgba(0,0,0,0.7)";
modeIndicator.style.color = "white";
modeIndicator.style.borderRadius = "6px";
modeIndicator.style.pointerEvents = "none";

document.body.appendChild(modeIndicator);


// --- Selection state ---
let isDragging = false;
let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;
let box = null;

let drawMode = false;
let keyListenerAdded = false;

let container = null;

let annotations = [];
let annotationLayer = document.createElement("div");

/*
function getViewerElement() {
  return document.querySelector(".openseadragon-canvas");
}

function getTransform(el) {
  const style = window.getComputedStyle(el);
  return style.transform;
}
*/ 

function syncOverlayTransform() {
  const canvas = container.querySelector(".openseadragon-canvas");
  if (!canvas) return;

  const style = window.getComputedStyle(canvas);
  const transform = style.transform;

  annotationLayer.style.transform = transform;
  annotationLayer.style.transformOrigin = "0 0";
}

function getContainerRect() {
  return container.getBoundingClientRect();
}

/*
function getScale(el) {
  const transform = getTransform(el);
  if (!transform || transform === "none") return 1;

  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return 1;

  const values = match[1].split(",");
  return parseFloat(values[0]); // scaleX
}
*/

// --- Toggle between drawing mode and default behavior ---
function setDrawMode(enabled) {
  drawMode = enabled;

  overlay.style.pointerEvents = enabled ? "auto" : "none";
  overlay.style.cursor = enabled ? "crosshair" : "default";

  console.log("Draw mode:", enabled);
  modeIndicator.textContent = enabled ? "DRAW MODE" : "NAV MODE";

  modeIndicator.style.background = enabled
    ? "rgba(180, 0, 0, 0.75)"
    : "rgba(0, 0, 0, 0.7)";
}

// --- Mouse down ---
function onMouseDown(e) {
  if (!drawMode) return;

  e.preventDefault();
  e.stopPropagation();

  console.log("onMouseDown fired");
  //if (!viewer || !e.target.closest(".openseadragon-canvas")) return;
  if (!container) return;

  viewerRect = getContainerRect()

  isDragging = true;

  startX = e.clientX - viewerRect.left;
  startY = e.clientY - viewerRect.top;

  box = document.createElement("div");
  box.style.position = "absolute";
  box.style.border = "2px dashed red";
  box.style.background = "rgba(25, 0, 255, 0.1)";
  box.style.pointerEvents = "none";

  box.style.left = `${startX}px`;
  box.style.top = `${startY}px`;

  annotationLayer.appendChild(box);
}

// --- Mouse move ---
function onMouseMove(e) {  
  if (!drawMode) return;

  e.preventDefault();
  e.stopPropagation();

  if (!isDragging || !box) return;

  endX = e.clientX - viewerRect.left;
  endY = e.clientY - viewerRect.top;
  
  box.style.width = Math.abs(endX - startX) + "px";
  box.style.height = Math.abs(endY - startY) + "px";

  box.style.left = Math.min(endX, startX) + "px";
  box.style.top = Math.min(endY, startY) + "px";
}

// --- Mouse up ---
function onMouseUp(e) {  
  if (!drawMode) return;

  e.preventDefault();
  e.stopPropagation();

  if (!isDragging || !box) return;

  isDragging = false;

  const overlayRect = overlay.getBoundingClientRect();
  
  const clamp = (v) => Math.max(0, Math.min(1, v));

  const x1 = Math.min(startX, endX);
  const y1 = Math.min(startY, endY);
  const x2 = Math.max(startX, endX);
  const y2 = Math.max(startY, endY);

  const normalized = {
    x: clamp(x1 / overlayRect.width),
    y: clamp(y1 / overlayRect.height),
    w: clamp((x2 - x1) / overlayRect.width),
    h: clamp((y2 - y1) / overlayRect.height)
  };
  
  console.log("Normalized:", normalized);

  annotations.push(normalized);
  renderAnnotations(); 
  
  box.remove();
  box = null;
}

function renderAnnotations() {
  if (!container) return;

  // remove old boxes
  container.querySelectorAll(".wt-annotation").forEach(el => el.remove());

  const rect = container.getBoundingClientRect();

  annotations.forEach(a => {
    const box = document.createElement("div");
    box.className = "wt-annotation";

    box.style.position = "absolute";
    box.style.left = (a.x * rect.width) + "px";
    box.style.top = (a.y * rect.height) + "px";
    box.style.width = (a.w * rect.width) + "px";
    box.style.height = (a.h * rect.height) + "px";

    box.style.border = "2px solid lime";
    box.style.background = "rgba(0,255,0,0.1)";
    box.style.pointerEvents = "none";

    annotationLayer.appendChild(box);
  });
}

function positionOverlay() {
  if (!container) return;

  const rect = container.getBoundingClientRect();

  overlay.style.top = rect.top + window.scrollY + "px";
  overlay.style.left = rect.left + window.scrollX + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
}

function initOverlay() {
  container = document.querySelector(".openseadragon-container");
  if (!container) {
    console.warn("Container not found");
    return;
  }

  console.log("Container found:", container);

  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
  //container.addEventListener("mousemove", renderAnnotations);
  // initially don't be in box drawing mode
  setDrawMode(false);

  annotationLayer.style.position = "absolute";
  annotationLayer.style.top = "0";
  annotationLayer.style.left = "0";
  annotationLayer.style.width = "100%";
  annotationLayer.style.height = "100%";
  annotationLayer.style.pointerEvents = "none";

  container.style.position = "absolute";
  container.appendChild(annotationLayer);
  container.appendChild(overlay); // MUST be last

  positionOverlay();

  const canvas = container.querySelector(".openseadragon-canvas");

  if (canvas) {
    new MutationObserver(syncOverlayTransform).observe(canvas, {
      attributes: true,
      attributeFilter: ["style"]
    });
  }
  
  if (!keyListenerAdded) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "t") {
        setDrawMode(!drawMode);
      }
    });
    keyListenerAdded = true;
  }
}

function waitForViewer() {
   const viewer = document.querySelector(".openseadragon-canvas");

  if (viewer) {
    console.log("Layer ready");
    initOverlay();
    return;
  }

  setTimeout(waitForViewer, 200);
}

waitForViewer();



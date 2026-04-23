console.log("WikiTree overlay with drag enabled");

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
overlay.style.background = "rgba(255,0,0,0.2)"; // light tint so you can see it
overlay.style.border = "3px solid red";
overlay.style.pointerEvents = "auto";

let viewerRect = null;

// --- Selection state ---
let isDragging = false;
let startX = 0;
let startY = 0;
let box = null;

let annotations = [];

function initOverlay(viewer) {
  if (!viewer) {
    console.warn("Viewer missing");
    return;
  }
  
  console.log("Viewer found:", viewer);

  viewer.insertBefore(overlay, viewer.firstChild);

  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mouseup", onMouseUp, true);
}

function waitForViewer() {
  const viewer = document.querySelector(".openseadragon-canvas");

  if (viewer) {
    console.log("Viewer ready");
    initOverlay(viewer);
    return;
  }

  setTimeout(waitForViewer, 200);
}

waitForViewer();

// --- Mouse down ---
function onMouseDown(e) {
  const viewer = document.querySelector(".openseadragon-canvas");
  if (!viewer || !e.target.closest(".openseadragon-canvas")) return;

  viewerRect = viewer.getBoundingClientRect();

  isDragging = true;

  startX = e.clientX - viewerRect.left;
  startY = e.clientY - viewerRect.top;

  box = document.createElement("div");
  box.style.position = "absolute";
  box.style.border = "2px dashed red";
  box.style.background = "rgba(255,0,0,0.1)";
  box.style.pointerEvents = "none";

  box.style.left = `${startX}px`;
  box.style.top = `${startY}px`;

  viewer.appendChild(box);
}

// --- Mouse move ---
function onMouseMove(e) {
  if (!isDragging || !box) return;

  const x = e.clientX - viewerRect.left;
  const y = e.clientY - viewerRect.top;

  box.style.width = Math.abs(x - startX) + "px";
  box.style.height = Math.abs(y - startY) + "px";

  box.style.left = Math.min(x, startX) + "px";
  box.style.top = Math.min(y, startY) + "px";
}

// --- Mouse up ---
function onMouseUp(e) {
  if (!isDragging || !box) return;

  isDragging = false;

  const rect = box.getBoundingClientRect();

  const clamp = (v) => Math.max(0, Math.min(1, v));

  const normalized = {
    x: clamp((rect.left - viewerRect.left) / viewerRect.width),
    y: clamp((rect.top - viewerRect.top) / viewerRect.height),
    w: Math.max(0, Math.min(1, rect.width / viewerRect.width)),
    h: Math.max(0, Math.min(1, rect.height / viewerRect.height))
  };

  console.log("Normalized:", normalized);

  box = null;
}

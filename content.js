console.log("WikiTree overlay with drag enabled");

document.addEventListener("mousedown", (e) => {
  console.log("GLOBAL mousedown");
}, true);

console.log("OSD:", window.OpenSeadragonImaging);

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

// --- Selection state ---
let isDragging = false;
let startX = 0;
let startY = 0;
let box = null;

let annotations = [];

// --- Mouse down ---
function onMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();

  console.log("onMouseDown fired");
  const viewer = document.querySelector(".openseadragon-canvas");
  //if (!viewer || !e.target.closest(".openseadragon-canvas")) return;
  if (!viewer) return;

  viewerRect = viewer.getBoundingClientRect();

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

  viewer.appendChild(box);
}

// --- Mouse move ---
function onMouseMove(e) {
  e.preventDefault();
  e.stopPropagation();

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
  e.preventDefault();
  e.stopPropagation();

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

function positionOverlay(viewer) {
  if (!viewer) return;

  const rect = viewer.getBoundingClientRect();

  overlay.style.top = rect.top + window.scrollY + "px";
  overlay.style.left = rect.left + window.scrollX + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
}

function initOverlay() {
  const viewer = document.querySelector(".openseadragon-canvas");

  if (!viewer) {
    console.warn("Viewer not found");
    return;
  }

  console.log("Viewer found:", viewer);

  //viewer.appendChild(overlay);
  //viewer.parentElement.appendChild(overlay);
  document.body.appendChild(overlay);

  positionOverlay(viewer);
  /*
const rect = viewer.getBoundingClientRect();

overlay.style.position = "absolute";
overlay.style.top = rect.top + window.scrollY + "px";
overlay.style.left = rect.left + window.scrollX + "px";
overlay.style.width = rect.width + "px";
overlay.style.height = rect.height + "px";
*/
  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
}

function waitForViewer() {
  const viewer = document.querySelector(".openseadragon-canvas");

  if (viewer) {
    console.log("Viewer ready");
    initOverlay();
    return;
  }

  setTimeout(waitForViewer, 200);
}

waitForViewer();

/*
function initOSDOverlay(osd) {
  console.log("Hooking OpenSeadragon events");

  osd.addHandler("canvas-press", onMouseDown);
  osd.addHandler("canvas-drag", onMouseMove);
  osd.addHandler("canvas-release", onMouseUp);

 /* if (!viewer) {
    console.warn("Viewer missing");
    return;
  }
  
  console.log("Viewer found:", viewer);

  viewer.appendChild(overlay); 
  viewer.addEventListener("mousedown", onMouseDown);
  viewer.addEventListener("mousemove", onMouseMove);
  viewer.addEventListener("mouseup", onMouseUp);
  */
 /*
}

function waitForViewer() {
  //const viewer = document.querySelector(".openseadragon-canvas");
  const osd =
    window.OpenSeadragonImaging ||
    window.viewer ||
    window.osdViewer;

  if (osd && osd.addHandler) {
    console.log("OpenSeadragon ready:", osd);
    initOSDOverlay(osd);
    return;
  }

  setTimeout(waitForViewer, 200);
}

waitForViewer();
*/


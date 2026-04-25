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
overlay.style.background = "rgba(255,0,0,0.1)"; // light tint so you can see it
overlay.style.border = "3px solid red";
overlay.style.pointerEvents = "auto";

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

let currentViewport = null;


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

  if (!container) return;

  isDragging = true;

  const rect = overlay.getBoundingClientRect();

  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

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

  const rect = overlay.getBoundingClientRect();

  endX = e.clientX - rect.left;
  endY = e.clientY - rect.top;
  
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

  const vp = currentViewport;

  const x1 = vp.x + (startX / overlayRect.width) * vp.w;
  const y1 = vp.y + (startY / overlayRect.height) * vp.h;
  const x2 = vp.x + (endX / overlayRect.width) * vp.w;
  const y2 = vp.y + (endY / overlayRect.height) * vp.h;

  // normalize in IMAGE SPACE
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  annotations.push({ x, y, w, h });

  renderAnnotations();
  
  box.remove();
  box = null;
}

function getViewportFromUrl() {
  const hash = window.location.hash;

  // hash looks like "#?xywh=..."
  const query = hash.startsWith("#") ? hash.slice(1) : hash;

  const params = new URLSearchParams(query);

  const xywh = params.get("xywh");

  if (!xywh) {
    console.warn("No xywh in hash:", hash);
    return null;
  }

  const [x, y, w, h] = xywh.split(",").map(Number);

  return { x, y, w, h };
}

function syncViewport() {
  currentViewport = getViewportFromUrl();
}

function renderAnnotations() {
  if (!container) return;

  syncViewport();

  const vp = currentViewport;
  const rect = container.getBoundingClientRect();

  annotationLayer.innerHTML = "";

  annotations.forEach(a => {
    const relX = (a.x - vp.x) / vp.w;
    const relY = (a.y - vp.y) / vp.h;
    const relW = a.w / vp.w;
    const relH = a.h / vp.h;

    const box = document.createElement("div");
    box.className = "wt-annotation";

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


function initOverlay() {
  container = document.querySelector(".openseadragon-container");
  if (!container) {
    console.warn("Container not found");
    return;
  }

  console.log("Container found:", container);

  // 🔥 correct positioning context
  container.style.position = "relative";

  // --- annotation layer ---
  annotationLayer.style.position = "absolute";
  annotationLayer.style.top = "0";
  annotationLayer.style.left = "0";
  annotationLayer.style.width = "100%";
  annotationLayer.style.height = "100%";
  annotationLayer.style.pointerEvents = "none";

  // --- overlay (interaction layer) ---
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";

  // attach events
  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);

  // add to DOM (order matters)
  container.appendChild(annotationLayer);
  container.appendChild(overlay);

  // initial mode
  setDrawMode(false);

  window.addEventListener("popstate", renderAnnotations);

  // keyboard toggle
  if (!keyListenerAdded) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "t") {
        setDrawMode(!drawMode);
      }
    });
    keyListenerAdded = true;
  }

  syncViewport(); // initial
  setInterval(syncViewport, 100); // keep it fresh
}

function waitForOSDContainer() {
  const container = document.querySelector(".openseadragon-canvas");

  if (container) {
    console.log("OSD container ready");
    initOverlay();
    return;
  }

  setTimeout(waitForOSDContainer, 200);
}

waitForOSDContainer();



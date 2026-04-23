console.log("WikiTree overlay with drag enabled");

function initOverlay(viewer) {

  if (!viewer) {
    console.warn("Viewer missing");
    return;
  }
  
  //viewer.setMouseNavEnabled(false);
  console.log("Viewer found:", viewer);
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


// --- Create overlay ---
const overlay = document.createElement("div");
overlay.id = "wt-overlay";

overlay.style.position = "absolute";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.zIndex = 9998;
overlay.style.cursor = "crosshair";
overlay.style.background = "rgba(0,0,0,0.05)"; // light tint so you can see it
overlay.style.pointerEvents = "auto";

waitForViewer();

window.addEventListener("load", () => {
  initOverlay();
});



// --- Selection state ---
let isDragging = false;
let startX = 0;
let startY = 0;
let box = null;

// --- Mouse down ---
overlay.addEventListener("mousedown", (e) => {
  isDragging = true;

  startX = e.clientX;
  startY = e.clientY;

  // Create selection box
  box = document.createElement("div");
  box.style.position = "absolute";
  box.style.border = "2px dashed red";
  box.style.background = "rgba(255,0,0,0.1)";
  box.style.left = `${startX}px`;
  box.style.top = `${startY}px`;

  overlay.appendChild(box);
});

// --- Mouse move ---
overlay.addEventListener("mousemove", (e) => {
  if (!isDragging || !box) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const x = Math.min(currentX, startX);
  const y = Math.min(currentY, startY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
});

// --- Mouse up ---
overlay.addEventListener("mouseup", (e) => {
  if (!isDragging || !box) return;

  isDragging = false;

  const rect = box.getBoundingClientRect();

  console.log("mouseup running");
  const viewer = document.querySelector(".openseadragon-canvas");

  if (!viewer) {
    console.warn("Viewer not found");
    return;
  }

  const viewerRect = viewer.getBoundingClientRect();

  const clamp = (v) => Math.max(0, Math.min(1, v));

  const normalized = {
    x: clamp((rect.left - viewerRect.left) / viewerRect.width),
    y: clamp((rect.top - viewerRect.top) / viewerRect.height),
    w: clamp(rect.width / viewerRect.width),
    h: clamp(rect.height / viewerRect.height)
  };

  console.log("Normalized:", normalized);

  box = null;

});
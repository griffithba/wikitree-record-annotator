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
let tool = "nav";  // null | "draw" | "select" 

let showAnnotations = true;
let selectedAnnotationId = null;

let lastPageKey = null;

// ============================================================
// MODE CONTROL
// ============================================================

function setTool(nextTool) {
  // toggle behavior
  tool = (tool === nextTool) ? null : nextTool;

  const isDraw = tool === "draw";

  overlay.style.pointerEvents = isDraw ? "auto" : "none";
  overlay.style.cursor = isDraw ? "crosshair" : "default";

  if (!showAnnotations && isDraw) {
    showAnnotations = true;
    renderAnnotations();
  }

  updateToolUI();
  updateToolbarButtons();

  // (optional) show overlay tint only in draw mode
  overlay.style.background = isDraw ? "rgba(255,0,0,0.1)" : "transparent";
  overlay.style.border = isDraw ? "2px solid red" : "none";

  console.log("Tool:", tool);
}

function makeToolButton(label, toolName) {
  const btn = document.createElement("button");

  btn.textContent = label;
  btn.dataset.tool = toolName;

  Object.assign(btn.style, {
    padding: "6px 10px",
    fontSize: "12px",
    cursor: "pointer"
  });

  btn.addEventListener("click", () => setTool(toolName));

  return btn;
}

function updateToolUI() {
  document.querySelectorAll(".wt-annotation").forEach(el => {
    if (tool === "select") {
      el.style.cursor = "pointer";
    } else {
      el.style.cursor = "default";
    }
  });

  overlay.style.cursor =
    tool === "draw" ? "crosshair" : "default";
}

function updateToolbarButtons() {
  document.querySelectorAll("#wt-toolbar button").forEach(btn => {
    const btnTool = btn.dataset.tool;

    if (btnTool && btnTool === tool) {
      btn.style.background = "#c33";
      btn.style.color = "white";
    } else {
      btn.style.background = "#eee";
      btn.style.color = "black";
    }
  });
}

// ============================================================
// MOUSE HANDLERS (DRAWING)
// ============================================================

function onMouseDown(e) {
  if (tool !== "draw" || !container) return;

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
  if (tool !== "draw" || !isDragging || !box) return;

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
  if (tool !== "draw" || !isDragging || !box) return;

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
    id: crypto.randomUUID(),
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
    wtId: null
  };
  
  // 🔥 Prompt immediately
  const wtId = prompt("Enter WikiTree ID (e.g., Smith-123):");

  // ❌ If user cancels or leaves blank → discard
  if (!wtId || !wtId.trim()) {
    box.remove();
    box = null;
    return;
  }

  if (!isValidWtId(wtId)) {
    alert("Invalid WikiTree ID format (e.g., Smith-123)");
    box.remove();
    box = null;
    return;
  }

  // ✅ Save only if valid
  annotation.wtId = wtId.trim();

  annotations.push(annotation);
  saveAnnotations();
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
// SAVING/CLEARING ANNOTATIONS
// ============================================================

function getPageKey() {
  const match = window.location.href.match(/([A-Z]\d+_\d+)/);
  return match ? match[1] : "unknown";
}

function saveAnnotations() {
  const key = getPageKey();
  localStorage.setItem(key, JSON.stringify(annotations));
}

function clearAnnotations() {
  annotations = [];
  saveAnnotations();
  renderAnnotations();
}

function loadAnnotationsIfNeeded() {
  const key = getPageKey();

  if (key === lastPageKey) return;

  lastPageKey = key;

  const saved = localStorage.getItem(key);

  annotations = saved ? JSON.parse(saved) : [];
}

function isValidWtId(id) {
  return /^\p{L}+-\d+$/u.test(id);
}
// ============================================================
// RENDERING
// ============================================================

function renderAnnotations() {
  if (!container) return;

  // Always sync before rendering (prevents lag)
  syncViewport();

  // Clear previous render
  annotationLayer.innerHTML = "";

  if (!showAnnotations) return;

  // 🔥 always ensure correct annotations for current page
  loadAnnotationsIfNeeded();

  const vp = currentViewport;
  if (!vp) return;

  const rect = container.getBoundingClientRect();

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

    box.className = "wt-annotation";
    
    if (a.id === selectedAnnotationId) {
      box.classList.add("wt-selected");
    }

    box.style.pointerEvents = "auto";
    if (tool === "select") {
      box.style.cursor = "pointer";
    } else {
      box.style.cursor = "default";
    }

    if (a.wtId) {
      box.title = a.wtId;
    }

    box.addEventListener("click", (e) => {
      if (tool === "select") {
        selectAnnotation(a.id);
        return;
      }

      if (a.wtId) {
        window.open(
          `https://www.wikitree.com/wiki/${encodeURIComponent(a.wtId)}`,
          "_blank"
        );
      }
    });

    box.dataset.id = a.id;

    annotationLayer.appendChild(box);
  });
}

function selectAnnotation(id) {
  selectedAnnotationId =
    selectedAnnotationId === id ? null : id;

  renderAnnotations();
}

function clearSelection() {
  if (!selectedAnnotationId) return;
  selectedAnnotationId = null;
  renderAnnotations();
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

  // Attach mouse events
  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);

  // Insert layers (order matters)
  container.appendChild(annotationLayer);
  container.appendChild(overlay);

  function createToolbar() {
    const bar = document.createElement("div");
    bar.id = "wt-toolbar";

    Object.assign(bar.style, {
      position: "fixed",
      top: "10px",
      right: "40px",
      zIndex: "100000",
      display: "flex",
      gap: "6px",
      padding: "6px",
      background: "rgba(0,0,0,0.7)",
      borderRadius: "8px"
    });

    document.body.appendChild(bar);

    return bar;
  }

  const toolbar = createToolbar();

  toolbar.appendChild(makeToolButton("Draw", "draw"));
  toolbar.appendChild(makeToolButton("Select", "select"));

  const toggleBtn = document.createElement("button");

  function updateToggleButton() {
    toggleBtn.textContent = showAnnotations ? "Hide" : "Show";
  }

  toggleBtn.addEventListener("click", () => {
    showAnnotations = !showAnnotations;
    updateToggleButton();
    renderAnnotations();
  });

  updateToggleButton();
  toolbar.appendChild(toggleBtn);

  overlay.addEventListener("click", clearSelection);

  // Keep viewport synced
  syncViewport();
  //loadAnnotationsIfNeeded();

  (function () {
    const originalReplaceState = history.replaceState;

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);

      // trigger re-render whenever viewer updates URL
      renderAnnotations();

      return result;
    };
  })();

  window.addEventListener("popstate", renderAnnotations);
//clearAnnotations();  // nuclear option to remove all annotations on a page on reload

  const style = document.createElement("style");
    style.textContent = `
      .wt-annotation {
        border: 2px solid lime;
        background: rgba(0,255,0,0.1);
        position: absolute;
        pointer-events: auto;
        transition: border 0.05s ease;
      }

      .wt-annotation.wt-selected {
        border: 3px solid orange;
        background: rgba(255,165,0,0.15);
      }
    `;
    document.head.appendChild(style);

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Delete") return;
    if (!selectedAnnotationId) return;

    annotations = annotations.filter(a => a.id !== selectedAnnotationId);
    selectedAnnotationId = null;
    saveAnnotations();
    renderAnnotations(); // rebuild geometry
  });
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


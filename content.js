// ============================================================
// WikiTree Overlay Annotation Tool
// ------------------------------------------------------------
// Allows drawing annotation boxes that stay aligned during
// zoom and pan by storing coordinates in image space (xywh).
// ============================================================

// Pull in the storage module
const storageAPI = window.storage;

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

// Drag state (for drawing boxes)
let isDragging = false;
let startX = 0, startY = 0;
let endX = 0, endY = 0;
let box = null;

// Mode state
let tool = null;  // null | "draw" | "select" 
let addingBoxToAnnotationId = null;

let showAnnotations = true;
let selectedAnnotationId = null;

let lastPageKey = null;


// ============================================================
// COLORS/STYLES
// ============================================================

function injectStyles() {
  if (document.getElementById("wt-styles")) return;

  const style = document.createElement("style");
  style.id = "wt-styles";

  style.textContent = `
    :root {
      --wt-draw-overlay-bg: rgba(255,0,0,0.1);
      --wt-draw-overlay-border: 2px solid red;
      --wt-draw-bg: rgba(25, 0, 255, 0.1);
      --wt-draw-border: 2px dashed red;
      --wt-toolbar-bg: rgba(255, 171, 15, 0.85);
    }
  
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
      
    .wt-ref-highlight {
      animation: wtPulse 1.5s ease-out 5;
    }

    @keyframes wtPulse {
      0%   { box-shadow: 0 0 0 0 rgba(255, 171, 15, 0.85); }
      100% { box-shadow: 0 0 0 12px rgba(0,255,255,0); }
    }

    .annotation {
      position: absolute;
    }

    .annotation-toolbar {
      position: absolute;
      top: -40px;
      right: 0;

      display: flex;
      gap: 4px;

      background: rgba(38, 35, 32, 0.8);
      padding: 4px 6px;
      border-radius: 6px;

      z-index: 10;

      pointer-events: auto;
    }

    .annotation-toolbar button {
      font-size: 18px;
      background: transparent;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
    }

    .resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: white;
      border: 2px solid black;
      border-radius: 50%;
      z-index: 20;
    }

    .resize-handle.nw { top: -6px; left: -6px; cursor: nwse-resize; }
    .resize-handle.ne { top: -6px; right: -6px; cursor: nesw-resize; }
    .resize-handle.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
    .resize-handle.se { bottom: -6px; right: -6px; cursor: nwse-resize; }
    
  `;
  document.head.appendChild(style);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getAnnotationById(id) {
  const a = annotations.find(x => x.id === id);
  if (!a) console.warn("Annotation not found:", id);
  return a || null;
}

function isPlausibleWtId(id) {
  return /^\p{L}+-\d+$/u.test(id);
}

// ============================================================
// MODE CONTROL
// ============================================================

function setTool(nextTool) {
  const prevTool = tool;
  // toggle behavior
  tool = (tool === nextTool) ? null : nextTool;

  if (prevTool === "select" && tool !== "select") {
    clearSelection();
    closeWtEditor?.();
  }

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
  overlay.style.background = isDraw ? "var(--wt-draw-overlay-bg)" : "transparent";
  overlay.style.border = isDraw ? "var(--wt-draw-overlay-border)" : "none";
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
      el.style.pointerEvents = "auto";
    } else {
      el.style.cursor = "default";
      el.style.pointerEvents = "auto";
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

function updateSelectionStyles() {
  document.querySelectorAll(".wt-annotation").forEach(box => {
    const id = box.dataset.annotationId;
    let toolbar = box.querySelector(".annotation-toolbar");
       
    if (String(id) === String(selectedAnnotationId)) {
      box.classList.add("wt-selected");
      if (!toolbar) {
        toolbar = createAnnotationToolbar(id);
        box.appendChild(toolbar);
        addResizeHandles(box, id);
      }
    } else {
      box.classList.remove("wt-selected");
      toolbar?.remove();
      box.querySelectorAll(".resize-handle").forEach(h => h.remove());
    }
  });
}

function createAnnotationToolbar(id) {
  const toolbar = document.createElement("div");
  toolbar.className = "annotation-toolbar";

  const addBtn = document.createElement("button");
  addBtn.textContent = "+";
  addBtn.title = "Add box";

  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️";
  editBtn.title = "Edit";

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️";
  deleteBtn.title = "Delete";

  addBtn.onclick = (e) => {
    e.stopPropagation();

    if (!selectedAnnotationId) return;

    // toggle behavior
    addingBoxToAnnotationId = addingBoxToAnnotationId ? null : selectedAnnotationId;
    overlay.style.pointerEvents = addingBoxToAnnotationId ? "auto" : "none";
    overlay.style.cursor = addingBoxToAnnotationId ? "crosshair" : "default";
  };
  
  editBtn.onclick = (e) => {
    e.stopPropagation();
    const box = document.querySelector(`[data-id="${selectedAnnotationId}"]`);
    const rect = box.getBoundingClientRect();
    editAnnotation
      (id, 
       rect.left + rect.width, 
       rect.top + rect.height);
  };

  deleteBtn.onclick = (e) => {
    e.stopPropagation();

    if (!deleteBtn.dataset.armed) {
      deleteBtn.dataset.armed = "true";
      deleteBtn.textContent = "⚠";
      deleteBtn.style.color = "yellow";
      deleteBtn.style.fontsize = "22px";
      deleteBtn.title = "Click again to delete";
      return;
    }

    const boxEl = deleteBtn.closest(".wt-annotation");
    const annotationId = boxEl.dataset.annotationId;
    const boxIndex = Number(boxEl.dataset.boxIndex);

    deleteBox(annotationId, boxIndex);
  };

  toolbar.append(addBtn, editBtn, deleteBtn);
  return toolbar;
}

// ============================================================
// RESIZING ANNOTATION BOXES
// ============================================================

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

let resizing = null;

function startResize(e, boxEl, corner) {
  const id = boxEl.dataset.annotationId;
  const annotation = getAnnotationById(id);
  if (!annotation) return;

  const boxIndex = Number(boxEl.dataset.boxIndex);
  const box = annotation.boxes[boxIndex];

  // STEP 1. get mouse position (overlay space)
  const rect = overlay.getBoundingClientRect();
  
  resizing = {
    id,
    boxIndex,
    corner,
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
    startBox: { ...box }
  };

  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup", stopResize);
}

function onResizeMove(e) {
  if (!resizing) return;

  const rect = overlay.getBoundingClientRect();
  const vp = currentViewport;

  // STEP 2. compute dx/dy (overlay space)
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  const dx = currentX - resizing.startX;
  const dy = currentY - resizing.startY;

  // STEP 3. convert dx/dy → image space
  const scaleX = vp.w / rect.width;
  const scaleY = vp.h / rect.height;

  const dxImg = dx * scaleX;
  const dyImg = dy * scaleY;

  // STEP 4. apply to annotation (image space)
  const annotation = getAnnotationById(resizing.id);
  if (!annotation) return;

  const box = annotation.boxes[resizing.boxIndex];

  // copy original
  let { x, y, w, h } = resizing.startBox;
  const corner = resizing.corner;

  if (corner.includes("e")) w += dxImg;
  if (corner.includes("s")) h += dyImg;
  if (corner.includes("w")) {
    x += dxImg;
    w -= dxImg;
  }
  if (corner.includes("n")) {
    y += dyImg;
    h -= dyImg;
  }

  // prevent negative sizes
  if (w < 0) {
    x = x + w;
    w = Math.abs(w);
  }

  if (h < 0) {
    y = y + h;
    h = Math.abs(h);
  }

  w = Math.max(20, w);
  h = Math.max(20, h);

  box.x = x;
  box.y = y;
  box.w = w;
  box.h = h;

  renderAnnotations();
}

function stopResize() {
  if (!resizing) return;

  saveAnnotationsForPage(annotations);

  resizing = null;

  document.removeEventListener("mousemove", onResizeMove);
  document.removeEventListener("mouseup", stopResize);
}

// ============================================================
// CREATING MULTIPLE BOXES FOR THE SAME ANNOTATION
// ============================================================

async function addBoxToSelected(newBox) {
  const a = getAnnotationById(selectedAnnotationId);
  if (!a) return;

  if (!a.boxes) {
    // migrate old annotation
    a.boxes = getBoxes(a);
    delete a.x; delete a.y; delete a.w; delete a.h;
  }

  a.boxes.push(newBox);

  await saveAnnotationsForPage(annotations);
  renderAnnotations();
}

// ============================================================
// FUNCTION FOR ENTERING/EDITING WT ID AND NOTE
// ============================================================

let wtEditor = null;

function createWtEditor() {
  wtEditor = document.createElement("div");

  Object.assign(wtEditor.style, {
    position: "absolute",
    zIndex: 100001,
    background: "black",
    color: "white",
    padding: "6px",
    borderRadius: "6px",
    display: "none",
    flexDirection: "column",
    gap: "4px"
  });

  wtEditor.innerHTML = `
  <div style="display:flex; flex-direction:column; gap:4px; font-family: Arial, sans-serif;">
    <div style="display:flex; align-items:center; gap:6px;">
      <span>WikiTree ID:</span>
      <input type="text" id="wt-input" style="width:120px;" />
    </div>

    <div style="display:flex; align-items:center; gap:6px;">
      <span>Optional note:</span>
      <input type="text" id="wt-note" style="width:180px;" />
    </div>

    <div style="display:flex; gap:6px;">
      <button id="wt-save">✔</button>
      <button id="wt-cancel">✖</button>
    </div>

    <div id="wt-error" style="color:red; font-size:11px;"></div>
  </div>  `;
  
  document.body.appendChild(wtEditor);

  const input = wtEditor.querySelector("#wt-input");
  const noteInput = wtEditor.querySelector("#wt-note");
  const saveBtn = wtEditor.querySelector("#wt-save");
  const cancelBtn = wtEditor.querySelector("#wt-cancel");
  const errorEl = wtEditor.querySelector("#wt-error");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") cancelBtn.click();
  });
  noteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") cancelBtn.click();
  });

  wtEditor.addEventListener("mousedown", e => e.stopPropagation()); 
}


function openWtEditor(
  { x, y, initialValue = "", initialNote = "", onSave, onCancel }) 
  {
    const input = wtEditor.querySelector("#wt-input");
    const noteInput = wtEditor.querySelector("#wt-note");
    const saveBtn = wtEditor.querySelector("#wt-save");
    const cancelBtn = wtEditor.querySelector("#wt-cancel");

    wtEditor.style.left = x + "px";
    wtEditor.style.top = y + "px";
    wtEditor.style.display = "flex";

    input.value = initialValue;
    input.focus();
    noteInput.value = initialNote;

    function cleanup() {
      wtEditor.style.display = "none";
      saveBtn.onclick = null;
      cancelBtn.onclick = null;
    }

    const errorEl = wtEditor.querySelector("#wt-error");
  
    saveBtn.onclick = () => {
      const value = input.value.trim();
      const note = noteInput.value.trim();
      
      if (!value) {
        errorEl.textContent = "ID required";
        return;
      }

      if (!isPlausibleWtId(value)) {
        errorEl.textContent = "Invalid format (e.g., Smith-123)";
        return;
      }

      errorEl.textContent = "";
      cleanup();
      onSave?.({wtId: value, 
                note: note});
  };

  cancelBtn.onclick = () => {
    cleanup();
    onCancel?.();
  };
}

function closeWtEditor() {
  if (wtEditor) {
    wtEditor.style.display = "none";
  }
}

// ============================================================
// MOUSE HANDLERS (DRAWING)
// ============================================================

function onMouseDown(e) {
  if ((tool !== "draw" && !addingBoxToAnnotationId) || !container) return;

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
  box.style.border = "var(--wt-draw-border)";
  box.style.background = "var(--wt-draw-background)";
  box.style.pointerEvents = "none";

  annotationLayer.appendChild(box);
}

function onMouseMove(e) {
  if ((tool !== "draw" && !addingBoxToAnnotationId) || !isDragging || !box) return;

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

async function onMouseUp(e) {
  if ((tool !== "draw" && !addingBoxToAnnotationId) || !isDragging || !box) return;

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
  const newBox = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    };

  if (addingBoxToAnnotationId) {
    const annotation = getAnnotationById(selectedAnnotationId);
    if (!annotation) return;

    // migrate old annotation if needed
    if (!annotation.boxes) {
      annotation.boxes = getBoxes(annotation);
      delete annotation.x;
      delete annotation.y;
      delete annotation.w;
      delete annotation.h;
    }

    annotation.boxes.push(newBox);

    await saveAnnotationsForPage(annotations);
    renderAnnotations();

    box.remove();
    box = null;

    // wait a moment for handlers to finish so we don't clear the selection
    setTimeout(() => {
      addingBoxToAnnotationId = null;
    }, 0);
    
    overlay.style.pointerEvents = "none";
    overlay.style.cursor = "default";
    
    return;

  } else {
    const annotation = {
      id: crypto.randomUUID(),
      page: getPageKey(),
      boxes : [newBox],
      wtId: null,
      name: null,
      birth: null,
      death: null,
      note: null, 
      status: "unknown"
    };

    // prompt for WT ID and optional note
    openWtEditor({
      x: e.clientX,
      y: e.clientY,
      initialValue: "",
      initialNote: "",
      onSave: async ({wtId, note}) => {
        annotation.wtId = wtId;
        annotation.note = note;
        annotations.push(annotation);
        await saveAnnotationsForPage(annotations);
        renderAnnotations();
        box.remove();
        box = null;
      },
      onCancel: () => {
        box.remove();
        box = null;
      }
    });
  }
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

async function saveAnnotationsForPage(pageAnnotations) {
  const key = getPageKey();

  const all = await storageAPI.getAnnotations();

  // remove old annotations for this page
  const others = all.filter(a => a.page !== key);

  // add updated ones
  const updated = [...others, ...pageAnnotations];

  // Use this function wrong and you'll delete all annotations for ALL other pages!
  await storageAPI.saveAnnotations(updated);
}

async function getAnnotationsByPage(pageKey) {
  const all = await storageAPI.getAnnotations();
  return all.filter(a => a.page === pageKey);
}

async function loadAnnotationsIfNeeded() {
  const key = getPageKey();

  if (key === lastPageKey) return;
  lastPageKey = key;

  let all = await storageAPI.getAnnotations();

  annotations = all.filter(a => a.page === key);
}

async function deleteBox(annotationId, boxIndex) {
  const annotation = getAnnotationById(annotationId);
  if (!annotation) return;

  // ensure multi-box structure
  if (!annotation.boxes) {
    annotation.boxes = getBoxes(annotation);
    delete annotation.x;
    delete annotation.y;
    delete annotation.w;
    delete annotation.h;
  }

  if (annotation.boxes.length > 1) {
    // remove just this box
    annotation.boxes.splice(boxIndex, 1);
  } else {
    // last box → delete entire annotation
    deleteAnnotation(annotationId);
    return;
  }

  await saveAnnotationsForPage(annotations);
  renderAnnotations();
}

async function deleteAnnotation(id) {
  annotations = annotations.filter(a => a.id !== selectedAnnotationId);
  selectedAnnotationId = null;
  await saveAnnotationsForPage(annotations);
  renderAnnotations(); // rebuild geometry
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

  // always ensure correct annotations for current page
  loadAnnotationsIfNeeded();

  const vp = currentViewport;
  if (!vp) return;

  const rect = container.getBoundingClientRect();

  annotations.forEach(a => {
    const boxes = getBoxes(a);

    boxes.forEach((boxData, index) => {
      renderBox(a, boxData, index);
    });
  });

  updateSelectionStyles();
  updateToolUI();
}

function renderBox(a, boxData, index) {
  const vp = currentViewport;
  const rect = overlay.getBoundingClientRect();

  // IMAGE SPACE → viewport-relative → screen pixels
  const relX = (boxData.x - vp.x) / vp.w;
  const relY = (boxData.y - vp.y) / vp.h;
  const relW = boxData.w / vp.w;
  const relH = boxData.h / vp.h;

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

  if (a.wtId) {
    box.title = buildTooltip(a);

    if (String(a.wtId) === String(incomingWtId)) {
      triggerRefHighlight(a.id);
    }
  }

  box.addEventListener("click", (e) => {
    if (tool === "select") {
      e.stopPropagation();
      const id = box.dataset.annotationId;
      selectAnnotation(id);
      return;
    }

    if (tool === "draw") return;

    if (a.wtId) {
      window.open(
        `https://www.wikitree.com/wiki/${encodeURIComponent(a.wtId)}`,
        "_blank"
      );
    }
  });

  // IMPORTANT: track both annotation + box
  box.dataset.annotationId = a.id;
  box.dataset.boxIndex = index;

  annotationLayer.appendChild(box);
}

function getBoxes(annotation) {
  if (annotation.boxes) return annotation.boxes;

  // fallback for old data
  return [{
    x: annotation.x,
    y: annotation.y,
    w: annotation.w,
    h: annotation.h
  }];
}

function selectAnnotation(id) {
  selectedAnnotationId = id;
  updateSelectionStyles();
}

function editAnnotation(id, screenX, screenY) {
  const annotation = getAnnotationById(id);
  if (!annotation) return;
  
  openWtEditor({
    x: screenX,
    y: screenY,
    initialValue: annotation.wtId || "oops",
    initialNote: annotation.note || "",

    onSave: async ({wtId, note}) => {
      annotation.wtId = wtId;
      annotation.note = note;

      await saveAnnotationsForPage(annotations);
      renderAnnotations();
    }
  });
}

function clearSelection() {
  console.log("Clearing selection");
  selectedAnnotationId = null;
  addingBoxToAnnotationId = null;
  updateSelectionStyles();
  closeWtEditor?.();
}

// If coming from a WT profile, the ID will be embedded in the URL
function getWtIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("wtId");
}

// display "Name (birth-death)" and note when hovering over an annotation
function buildTooltip(a) {
  let text = a.wtId || "Unknown";
  if (a.name || a.birth || a.death) {
    const years = (a.birth || "?") + "-" + (a.death || "?");

    text = `${a.name || "Unknown"} (${years})`;
  }
    
  if (a.note) {
    text += "\n" + a.note;
  }
    
  return text; 
}


// If we came from a profile that has an annotation on this page then highlight the annotation
const highlightedAnnotations = new Set();
function triggerRefHighlight(annotationId) {
  // only highlight it one time, not on every re-render
  if (highlightedAnnotations.has(annotationId)) return; 

  function start() {
    highlightedAnnotations.add(annotationId);

    // highlight ALL boxes for this annotation
    requestAnimationFrame(() => {
      document.querySelectorAll(
        `[data-annotation-id="${annotationId}"]`
      ).forEach(box => {
        box.classList.add("wt-ref-highlight");
      });
    });
  }

  if (document.visibilityState === "visible") {
    start();
  } else {  // If tab was brought up in the background then wait to highlight
    const onVisible = () => {
      document.removeEventListener("visibilitychange", onVisible);
      start();
    };

    document.addEventListener("visibilitychange", onVisible);
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

// ID of WikiTree profile we came from (if we came from one)
let incomingWtId = null;

async function seedIfEmpty() {
  await loadAnnotationsIfNeeded();

  if (!annotations || annotations.length === 0) {
    const pageKey = getPageKey();
    annotations = sampleAnnotations.filter(a => a.page === pageKey);

    await saveAnnotationsForPage(annotations);
    renderAnnotations();
  }
}

function initOverlay() {
  container = document.querySelector(".openseadragon-container");
  if (!container) return;

  // If arriving from a WikiTree profile, grab the ID
  incomingWtId = getWtIdFromUrl();
    
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

  container.addEventListener("click", (e) => {
    if (tool !== "select" || addingBoxToAnnotationId) return;
    
    // If click was on an annotation, ignore
    if (e.target.closest(".wt-annotation")) return;

    clearSelection();
  });

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
      background: "var(--wt-toolbar-bg)",
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

  // create editor
  createWtEditor();
  
  // Keep viewport synced
  syncViewport();
  
  // Load and render any pre-existing annotations
  loadAnnotationsIfNeeded();
  requestAnimationFrame(() => {
    renderAnnotations();
    updateToolUI();
  });
  
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

  // Set border and background colors
  injectStyles();

  // If this is the first run, start with some seed data
  seedIfEmpty();
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


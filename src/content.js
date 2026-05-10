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
const storageAPI = window.storage;

// Transparent interaction layer (captures mouse input)
const overlay = document.createElement("div");
overlay.id = "wt-overlay";

// Visual layer for rendered annotations
const annotationLayer = document.createElement("div");
annotationLayer.id = "wt-annotation-layer";

// Cache expiration time (in milliseconds)
// Set to 14 days: 14 * 24 * 60 * 60 * 1000
const days = 14;
const PERSON_CACHE_MAX_AGE_MS = days * 24 * 60 * 60 * 1000;


// ============================================================
// SECTION 2: STATE MANAGEMENT
// ============================================================
// Core state variables organized by purpose

// viewport context
let currentViewport = null;           // {x,y,w,h} from URL hash (IIIF image space)

// Annotations array (stored in IMAGE SPACE coordinates)
let annotations = [];
let people = {};
let peopleLoaded = false;

let renderInProgress = false;

// Drawing/drag state for box creation
let isDragging = false;               // Currently drawing a box
let startX = 0, startY = 0;          // Box start (in overlay pixels)
let endX = 0, endY = 0;              // Box end (in overlay pixels)
let box = null;                       // Temporary DOM element while dragging

// Tool and interaction state
let tool = null;                      // Active tool: null | "draw" | "select"
let addingBoxToAnnotationId = null;   // Non-null when adding box to existing annotation

// Display and selection state
let showAnnotations = true;           // Toggle visibility of all annotations
let selectedAnnotationId = null;      // Currently selected annotation (for editing/resizing)

// Page tracking for lazy loading
let lastPageKey = null;               // Track current page to avoid redundant loads

// ID from incoming WikiTree profile (if navigated from one)
let incomingWtId = null;

// Whether to pre-fill the WtId editor with the incoming WtId on creation
let preFillWtIdOnCreate = false;

// Dialog element for editing annotation WT ID and notes
let wtEditor = null;

// Track which annotations have been highlighted already
const highlightedAnnotations = new Set();

// Resize state (when dragging resize handles)
let resizing = null;

const enrichmentInProgress = new Set();

// ============================================================
// SECTION 3: STYLES & CSS INJECTION
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
// SECTION 4: UTILITY HELPERS
// ============================================================
// Pure helper functions without side effects

/**
 * Finds annotation by ID
 * @param {string} id - Annotation ID
 * @returns {Object|null} Annotation object or null if not found
 */
function getAnnotationById(id) {
  const a = annotations.find(x => x.id === id);
  if (!a) console.warn("Annotation not found:", id);
  return a || null;
}

/**
 * Validates WikiTree ID format (e.g., "Smith-123")
 * @param {string} id - Potential WikiTree ID
 * @returns {boolean} True if format is valid
 */
function isPlausibleWtId(id) {
  return /^\p{L}+-\d+$/u.test(id);
}

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

  let person = people[a.wtId];
  let text = a.wtId;

  if (person && (person.name || person.birth || person.death)) {
    const years = (person.birth || "") + "-" + (person.death || "");
    text = `${person.name || a.wtId} (${years})`;
  }
    
  if (a.note) {
    text += "\n" + a.note;
  }
    
  return text; 
}


// ============================================================
// SECTION 5: TOOL & MODE CONTROL
// ============================================================

/**
 * Switch between tools (draw/select) with toggle behavior
 * When switching away from "select", clears selection
 * @param {string} nextTool - Tool to switch to: "draw" | "select"
 */
function setTool(nextTool) {
  const prevTool = tool;
  
  // Toggle behavior: clicking same tool twice turns it off
  tool = (tool === nextTool) ? null : nextTool;

  // Clean up when leaving select mode
  if (prevTool === "select" && tool !== "select") {
    clearSelection();
    closeWtEditor();
  }

  const isDraw = tool === "draw";

  // Update overlay interaction
  overlay.style.pointerEvents = isDraw ? "auto" : "none";
  overlay.style.cursor = isDraw ? "crosshair" : "default";

  // Auto-show annotations when entering draw mode
  if (!showAnnotations && isDraw) {
    showAnnotations = true;
    renderAnnotations();
  }

  updateToolUI();
  updateToolbarButtons();

  // Visual feedback: tint overlay only in draw mode
  overlay.style.background = isDraw ? "var(--wt-draw-overlay-bg)" : "transparent";
  overlay.style.border = isDraw ? "var(--wt-draw-overlay-border)" : "none";
}

/**
 * Creates a button for tool selection
 * @param {string} label - Button label text
 * @param {string} toolName - Tool identifier ("draw" | "select")
 * @returns {HTMLElement} Button element
 */
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

/**
 * Updates cursor style on annotation boxes based on active tool
 */
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

/**
 * Updates toolbar button highlighting to show active tool
 */
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
// SECTION 6: ANNOTATION SELECTION & DISPLAY
// ============================================================

/**
 * Selects an annotation by ID and updates UI
 * Shows toolbar and resize handles
 * @param {string} id - Annotation ID to select
 */
function selectAnnotation(id) {
  selectedAnnotationId = id;
  updateSelectionStyles();
}

/**
 * Clears current selection and closes any open dialogs
 * Counterpart to selectAnnotation()
 */
function clearSelection() {
  console.log("Clearing selection");
  selectedAnnotationId = null;
  addingBoxToAnnotationId = null;
  updateSelectionStyles();
  closeWtEditor();
}

/**
 * Updates visual styles for all annotation boxes based on selection state
 * Shows/hides toolbar and resize handles as needed
 */
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

/**
 * Creates toolbar with +, ✏️, 🗑️ buttons for selected annotation
 * @param {string} id - Annotation ID
 * @returns {HTMLElement} Toolbar div
 */
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

  // "+" button: toggle "add box to annotation" mode
  addBtn.onclick = (e) => {
    e.stopPropagation();

    if (!selectedAnnotationId) return;

    // Toggle behavior
    addingBoxToAnnotationId = addingBoxToAnnotationId ? null : selectedAnnotationId;
    overlay.style.pointerEvents = addingBoxToAnnotationId ? "auto" : "none";
    overlay.style.cursor = addingBoxToAnnotationId ? "crosshair" : "default";
  };
  
  // "✏️" button: open WT ID editor
  editBtn.onclick = (e) => {
    e.stopPropagation();
    const box = e.target.closest(".wt-annotation");
    if (!box) return;
    const rect = box.getBoundingClientRect();
    editAnnotation(id, rect.left + rect.width, rect.top + rect.height);
  };

  // "🗑️" button: delete with confirmation
  deleteBtn.onclick = (e) => {
    e.stopPropagation();

    if (!deleteBtn.dataset.armed) {
      // First click: arm for deletion
      deleteBtn.dataset.armed = "true";
      deleteBtn.textContent = "⚠";
      deleteBtn.style.color = "yellow";
      deleteBtn.style.fontsize = "22px";
      deleteBtn.title = "Click again to delete";
      return;
    }

    // Second click: execute deletion
    const boxEl = deleteBtn.closest(".wt-annotation");
    const annotationId = boxEl.dataset.annotationId;
    const boxIndex = Number(boxEl.dataset.boxIndex);

    const annotation = getAnnotationById(annotationId);

    deleteBox(annotationId, boxIndex);
  };

  toolbar.append(addBtn, editBtn, deleteBtn);
  return toolbar;
}


// ============================================================
// SECTION 7: ANNOTATION EDITOR (WT ID & NOTES)
// ============================================================

/**
 * Creates the modal dialog for editing WT ID and notes.
 * Dialog is hidden by default and shown via openWtEditor().
 * Only called at init.
 */
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

  // Handle Enter/Escape in input fields
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") cancelBtn.click();
  });
  noteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") cancelBtn.click();
  });

  // Prevent dialog from being dragged away
  wtEditor.addEventListener("mousedown", e => e.stopPropagation()); 
}

/**
 * Opens the WT ID/note editor dialog at specified position
 * @param {Object} options
 * @param {number} options.x - Screen X position
 * @param {number} options.y - Screen Y position
 * @param {string} [options.initialValue=""] - Initial WT ID
 * @param {string} [options.initialNote=""] - Initial note
 * @param {Function} [options.onSave] - Callback with {wtId, note}
 * @param {Function} [options.onCancel] - Callback on cancel
 */
function openWtEditor(
  { x, y, initialValue = "", initialNote = "", onSave, onCancel }) 
  {
    const input = wtEditor.querySelector("#wt-input");
    const noteInput = wtEditor.querySelector("#wt-note");
    const saveBtn = wtEditor.querySelector("#wt-save");
    const cancelBtn = wtEditor.querySelector("#wt-cancel");
    const errorEl = wtEditor.querySelector("#wt-error");

    wtEditor.style.left = x + "px";
    wtEditor.style.top = y + "px";
    wtEditor.style.display = "flex";

    input.value = initialValue;
    input.focus();
    noteInput.value = initialNote;

    // Cleanup helper
    function cleanup() {
      wtEditor.style.display = "none";
      saveBtn.onclick = null;
      cancelBtn.onclick = null;
    }
  
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
      onSave?.({wtId: value, note: note});
  };

  cancelBtn.onclick = () => {
    cleanup();
    onCancel?.();
  };
}

/**
 * Closes the WT ID/note editor dialog
 */
function closeWtEditor() {
  if (wtEditor) {
    wtEditor.style.display = "none";
  }
}

/**
 * Opens editor to modify WT ID and note for an existing annotation
 * @param {string} id - Annotation ID
 * @param {number} screenX - Screen X position for dialog
 * @param {number} screenY - Screen Y position for dialog
 */
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
  const annotation = getAnnotationById(id);
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

  renderAnnotations();
}

/**
 * Finalizes resize drag and saves changes
 */
function stopResize() {
  if (!resizing) return;

  saveAnnotationsForPage(annotations);

  resizing = null;

  document.removeEventListener("mousemove", onResizeMove);
  document.removeEventListener("mouseup", stopResize);
}


// ============================================================
// SECTION 9: MOUSE HANDLERS (DRAWING BOXES)
// ============================================================

/**
 * Handles mousedown to start drawing a new box
 * Creates temporary DOM element that follows mouse
 */
function onMouseDown(e) {
  if (tool !== "draw" && !addingBoxToAnnotationId) return;

  e.preventDefault();
  e.stopPropagation();

  isDragging = true;

  const rect = overlay.getBoundingClientRect();

  // Record starting point in overlay pixel space
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  // Create temporary visual feedback box
  box = document.createElement("div");
  box.style.position = "absolute";
  box.style.border = "var(--wt-draw-border)";
  box.style.background = "var(--wt-draw-bg)";
  box.style.pointerEvents = "none";

  annotationLayer.appendChild(box);
}

/**
 * Handles mousemove during box drawing
 * Updates temporary box dimensions to follow cursor
 */
function onMouseMove(e) {
  if ((tool !== "draw" && !addingBoxToAnnotationId) || !isDragging || !box) return;

  e.preventDefault();
  e.stopPropagation();

  const rect = overlay.getBoundingClientRect();

  // Current mouse position in overlay space
  endX = e.clientX - rect.left;
  endY = e.clientY - rect.top;

  // Normalize for drawing in any direction
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  box.style.left = left + "px";
  box.style.top = top + "px";
  box.style.width = width + "px";
  box.style.height = height + "px";
}

/**
 * Handles mouseup to finish drawing box
 * Either adds box to new annotation (prompts for WT ID) or existing annotation
 */
async function onMouseUp(e) {
  if ((tool !== "draw" && !addingBoxToAnnotationId) || !isDragging || !box) return;

  e.preventDefault();
  e.stopPropagation();

  isDragging = false;

  const overlayRect = overlay.getBoundingClientRect();
  const vp = currentViewport;
  if (!vp) return;

  // STEP 1: Convert overlay pixels to image space
  // Formula: imageCoord = viewport.origin + (screenPixel / screenSize) * viewport.size
  const x1 = vp.x + (startX / overlayRect.width) * vp.w;
  const y1 = vp.y + (startY / overlayRect.height) * vp.h;
  const x2 = vp.x + (endX / overlayRect.width) * vp.w;
  const y2 = vp.y + (endY / overlayRect.height) * vp.h;

  // STEP 2: Normalize rectangle in image space
  const newBox = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    };

  if (addingBoxToAnnotationId) {
    // Case 1: Adding box to existing annotation
    const annotation = getAnnotationById(selectedAnnotationId);
    if (!annotation) return;

    annotation.boxes.push(newBox);

    await saveAnnotationsForPage(annotations);
    renderAnnotations();

    box.remove();
    box = null;

    // Clear add-box mode after handlers finish
    setTimeout(() => {
      addingBoxToAnnotationId = null;
    }, 0);
    
    overlay.style.pointerEvents = "none";
    overlay.style.cursor = "default";
    
    return;

  } else {
    // Case 2: Creating new annotation
    const annotation = {
      id: crypto.randomUUID(),
      page: getPageKey(),
      source: sourceSite,
      url: getCleanPageUrl(),
      reference: getReferenceFromPage(),
      boxes: [newBox],
      wtId: null,
      note: null, 
      status: "unknown"
    };

    // Prompt user for WikiTree ID
    openWtEditor({
      x: e.clientX,
      y: e.clientY,
      initialValue: preFillWtIdOnCreate ? incomingWtId : "",
      initialNote: "",
      onSave: async ({wtId, note}) => {
        annotation.wtId = wtId;
        annotation.note = note;
        annotations.push(annotation);
        await saveAnnotationsForPage(annotations);
        if (!people[wtId] || 
            (people[wtId].status === "unknown") || 
            (Date.now() - people[wtId].cachedAt > PERSON_CACHE_MAX_AGE_MS)) {
          enrichPersonData(wtId);
        }
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
// SECTION 10: STORAGE & PERSISTENCE
// ============================================================

/**
 * Saves annotations for current page to storage
 * Preserves annotations for other pages
 * @param {Array} pageAnnotations - Annotations to save for this page
 */
async function saveAnnotationsForPage(pageAnnotations) {
  const key = getPageKey();

  const all = await storageAPI.getAnnotations();

  // Remove old annotations for this page
  const others = all.filter(a => a.page !== key);

  // Add updated ones
  const updated = [...others, ...pageAnnotations];

  // WARNING: Using this function incorrectly will delete all annotations!
  await storageAPI.saveAnnotations(updated);
}

/**
 * Gets all annotations for a specific page
 * @param {string} pageKey - Page identifier
 * @returns {Array} Annotations for that page
 */
async function getAnnotationsByPage(pageKey) {
  const all = await storageAPI.getAnnotations();
  return all.filter(a => a.page === pageKey);
}

/**
 * Loads annotations for current page if not already loaded
 * Lazy loads to avoid loading every page's annotations at startup
 */
async function loadAnnotationsIfNeeded() {
  const key = getPageKey();

  if (key === lastPageKey) return;  // Already loaded
  lastPageKey = key;

  const all = await storageAPI.getAnnotations();

  // only store annotations specific to this page
  annotations = all.filter(a => a.page === key);

  people = await storageAPI.getPeople();

  let saveNeeded = false;

  // loop through annotations making sure their people are fresh
  annotations.forEach(a => {
    // clean up from old format
    if (a.name) {delete a.name; saveNeeded = true;}
    if (a.birth) {delete a.birth; saveNeeded = true;}
    if (a.death) {delete a.death; saveNeeded = true;}
    if (a.status) {delete a.status; saveNeeded = true;}

    let person = people[a.wtId];
    if (!person || (person.status === "unknown") || (Date.now() - person.cachedAt > PERSON_CACHE_MAX_AGE_MS)) {
      enrichPersonData(a.wtId);
    }
  });

  if (saveNeeded) await saveAnnotationsForPage(annotations);

}


// ============================================================
// SECTION 11: ANNOTATION OPERATIONS (ADD/DELETE)
// ============================================================

/**
 * Adds a new box to an existing annotation
 * (Also called via toolbar "+" button)
 * @param {Object} newBox - Box coordinates {x, y, w, h} in image space
 */
/*
async function addBoxToSelected(newBox) {
  const a = getAnnotationById(selectedAnnotationId);
  if (!a) return;

  a.boxes.push(newBox);

  await saveAnnotationsForPage(annotations);
  renderAnnotations();
}
  */

/**
 * Deletes a specific box from an annotation
 * If last box, deletes entire annotation
 * @param {string} annotationId - Annotation ID
 * @param {number} boxIndex - Index of box to delete
 */
async function deleteBox(annotationId, boxIndex) {
  const annotation = getAnnotationById(annotationId);
  if (!annotation) return;

  if (annotation.boxes.length > 1) {
    // Remove just this box
    annotation.boxes.splice(boxIndex, 1);
  } else {
    // Last box → delete entire annotation
    deleteAnnotation(annotationId);
    return;
  }

  await saveAnnotationsForPage(annotations);
  renderAnnotations();
}

/**
 * Deletes entire annotation and clears selection
 * @param {string} id - Annotation ID
 */
async function deleteAnnotation(id) {
  annotations = annotations.filter(a => a.id !== id);
  await saveAnnotationsForPage(annotations);
  if (selectedAnnotationId === id) clearSelection();
  renderAnnotations();
}


/**
 * Requests WikiTree enrichment from background script
 * and applies returned data to the annotation.
 */
async function enrichPersonData(wtId) {

  if (enrichmentInProgress.has(wtId)) return;

  enrichmentInProgress.add(wtId);

  chrome.runtime.sendMessage(
    {
      type: "ENRICH_PERSON",
      wtId
    },
    async (response) => {
      try {
        if (!response || response.error) return;
        // add a timestamp so we know when it needs to be re-fetched
        response.cachedAt = Date.now();
        // store locally for this session
        people[wtId] = response;
        // store in person DB
        await storageAPI.savePerson(wtId, response);
        renderAnnotations();
      } finally {
        enrichmentInProgress.delete(wtId);
      }
    }
  );
}


// ============================================================
// SECTION 12: RENDERING ANNOTATIONS
// ============================================================

/**
 * Main render loop for all annotations
 * Syncs viewport, clears previous render, renders all boxes
 */
async function renderAnnotations() {
  if (renderInProgress) return;
  renderInProgress = true;

  try {
    const container = getViewerContainer();
    if (!container) return;

    // Always sync viewport first (prevents lag when zooming)
    syncViewport();

    // Clear previous render
    annotationLayer.innerHTML = "";

    if (!showAnnotations) return;

    // Load annotations for current page if not yet loaded
    await loadAnnotationsIfNeeded();

    const vp = currentViewport;
    if (!vp) return;

    //const rect = container.getBoundingClientRect();

    // Render each annotation's boxes
    annotations.forEach(a => {
      a.boxes.forEach((boxData, index) => {
        renderBox(a, boxData, index);
      });
    });

    updateSelectionStyles();
    updateToolUI();
  
  } finally {
    renderInProgress = false;
  }
}

/**
 * Renders a single annotation box on screen
 * Converts image space coordinates to screen pixels
 * @param {Object} a - Annotation object
 * @param {Object} boxData - Box coordinates {x, y, w, h} in image space
 * @param {number} index - Box index within annotation
 */
function renderBox(a, boxData, index) {
  const vp = currentViewport;
  const rect = overlay.getBoundingClientRect();

  // STEP 1: Convert image space → viewport-relative → screen pixels
  // viewport-relative: how far through the viewport is this coordinate?
  const relX = (boxData.x - vp.x) / vp.w;
  const relY = (boxData.y - vp.y) / vp.h;
  const relW = boxData.w / vp.w;
  const relH = boxData.h / vp.h;

  const box = document.createElement("div");

  // STEP 2: Convert viewport-relative to screen pixels
  box.style.position = "absolute";
  box.style.left = (relX * rect.width) + "px";
  box.style.top = (relY * rect.height) + "px";
  box.style.width = (relW * rect.width) + "px";
  box.style.height = (relH * rect.height) + "px";

  box.className = "wt-annotation";

  // Add selection styling if needed
  if (a.id === selectedAnnotationId) {
    box.classList.add("wt-selected");
  }

  // Set tooltip
  if (a.wtId) {
    box.title = buildTooltip(a);

    // Highlight if this annotation matches incoming profile
    if (String(a.wtId) === String(incomingWtId)) {
      triggerRefHighlight(a.id);
      // don't assume new annotations are for the incoming WikiTree ID if there's
      // already one for that ID
      preFillWtIdOnCreate = false;
    }
  }

  // Click handler: select in select mode, or open WikiTree profile
  box.addEventListener("click", (e) => {
    if (tool === "select") {
      e.stopPropagation();
      const id = box.dataset.annotationId;
      selectAnnotation(id);
      return;
    }

    if (tool === "draw") return;

    // Default: click to open WikiTree profile
    if (a.wtId) {
      window.open(
        `https://www.wikitree.com/wiki/${encodeURIComponent(a.wtId)}`,
        "_blank"
      );
    }
  });

  // Track annotation ID and box index for toolbar/resize operations
  box.dataset.annotationId = a.id;
  box.dataset.boxIndex = index;

  if (people[a.wtId]?.status === "invalid") {
    addInvalidBadge(box);
  }

  annotationLayer.appendChild(box);
}

function addInvalidBadge(boxEl) {
  const badge = document.createElement("div");

  badge.textContent = "⛓️‍💥";

  Object.assign(badge.style, {
    position: "absolute",
    top: "2px",
    right: "2px",
    fontSize: "18px",
    lineHeight: "14px",
    pointerEvents: "none",
    zIndex: "2"
  });

  boxEl.appendChild(badge);
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

  const container = getViewerContainer();
  if (!container) return;

  // Get incoming WikiTree profile ID if present
  incomingWtId = getWtIdFromUrl();

  // Set flag to pre-fill the editor with the incoming WikiTree profile ID
  if (incomingWtId) preFillWtIdOnCreate = true;
    
  // Set up positioning context for overlay
  container.style.position = "relative";

  createOverlayLayers();
  attachOverlayEvents();
  
  // Create the WikiTree annotation toolbar
  createToolbar();
  
  // Create editor dialog
  createWtEditor();
  
  // Align viewport and initialize tracking 
  initializeViewportTracking();

  // Inject CSS styles
  injectStyles();

  // Load seed data if empty, then render
  seedCurrentPageIfEmpty().then(() => {
    requestAnimationFrame(() => {
      renderAnnotations();
      updateToolUI();
    });
  });

  
  /**
   *  Local init functions
   */

  function createOverlayLayers() {
    // remove any stale overlays first
    document.getElementById("wt-toolbar")?.remove();
    document.getElementById("wt-overlay")?.remove();
    
    // Annotation layer: visual only, no interaction
    Object.assign(annotationLayer.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    });

    // Overlay layer: interaction capture, no visuals
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

    // Insert layers in order (annotation below overlay)
    container.appendChild(annotationLayer);
    container.appendChild(overlay);
  }

  function attachOverlayEvents() {
    // Attach mouse event handlers
    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);

    // Container click: clear selection when clicking empty space
    container.addEventListener("click", (e) => {
      if (tool !== "select" || addingBoxToAnnotationId) return;
    
      // If click was on an annotation, ignore
      if (e.target.closest(".wt-annotation")) return;

      clearSelection();
    });
  }
  
  // create toolbar
  function createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = "wt-toolbar";

    Object.assign(toolbar.style, {
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
    
    // Add tool buttons to toolbar
    toolbar.appendChild(makeToolButton("Draw", "draw"));
    toolbar.appendChild(makeToolButton("Select", "select"));

    // Button for toggling show/hide annotations
    const toggleBtn = document.createElement("button");
    // initial button label
    toggleBtn.textContent = showAnnotations ? "Hide" : "Show";

    toggleBtn.addEventListener("click", () => {
      showAnnotations = !showAnnotations;
      toggleBtn.textContent = showAnnotations ? "Hide" : "Show";
      renderAnnotations();
    });

    // Add toggle button to toolbar
    toolbar.appendChild(toggleBtn);

    // attach the toolbar
    document.body.appendChild(toolbar);
  }
}

/**
 * Seeds page with sample annotations on first visit
 * Only does this if annotations array is empty
 */
async function seedCurrentPageIfEmpty() {
  await loadAnnotationsIfNeeded();

  if (!annotations || annotations.length === 0) {
    const pageKey = getPageKey();
    annotations = sampleAnnotations.filter(a => a.page === pageKey);

    await saveAnnotationsForPage(annotations);
  }
}

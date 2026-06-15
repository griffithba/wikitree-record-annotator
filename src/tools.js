(() => {

  "use strict";

  let _currentTool = null;               // Active tool: null | "draw" | "select"
  function getTool() {
    return _currentTool;
  }
  function isDrawing() {
    return _currentTool === "draw";
  }
  function isSelecting() {
    return _currentTool === "select";
  }


  let _selectedAnnotationId = null;      // Currently selected annotation (for editing/resizing)
  function getSelectedAnnotationId() {
    return _selectedAnnotationId;
  }


  let _activeBoxIndex = null;            // Index of selected box
  function getActiveFrameIndex() {
    return _activeBoxIndex;
  }


  let _activeDrawingPerson = null;      // WikiTree ID of person associated with the box currently being drawn
  function setActiveDrawingPerson(person) {
    _activeDrawingPerson = person;
  }
  function clearActiveDrawingPerson() {
    _activeDrawingPerson = null;
  }


   // Drawing/drag state for box creation
  let _isDragging = false;               // Currently drawing a box
  let _startX = 0, _startY = 0;           // Box start (in overlay pixels)
  let _endX = 0, _endY = 0;               // Box end (in overlay pixels)
  let _box = null;                       // Temporary DOM element while dragging
  let _resizing = null;                  // Resize state (when dragging resize handles)


  // ============================================================
  // ANNOTATION SELECTION & DISPLAY
  // ============================================================

  /**
   * Selects an annotation by ID and updates UI
   * Shows toolbar and resize handles
   * @param {string} id - Annotation ID to select
   * @param {number} index - Index of the box within the annotation
   */
  function selectAnnotation(id, index) {
    _selectedAnnotationId = id;
    _activeBoxIndex = index;
    overlay.updateSelectionStyles();
  }


  /**
   * Clears current selection and closes any open dialogs
   * Counterpart to selectAnnotation()
   */
  function clearSelection() {
    _selectedAnnotationId = null;
    _activeBoxIndex = null;
    _addingBoxToAnnotationId = null;
    overlay.updateSelectionStyles();
    ui.closeWtEditor();
  }


  // ============================================================
  // MOUSE HANDLERS (DRAWING BOXES)
  // ============================================================

  /**
   * Handles mousedown to start drawing a new box
   * Creates temporary DOM element that follows mouse
   */
  function onMouseDown(e) {
    if (!isDrawing()) return;

    e.preventDefault();
    e.stopPropagation();

    _isDragging = true;

    const rect = overlay.getOverlayElement().getBoundingClientRect();

    // Record starting point in overlay pixel space
    _startX = e.clientX - rect.left;
    _startY = e.clientY - rect.top;

    // Create temporary visual feedback box
    _box = document.createElement("div");
    _box.style.position = "absolute";
    _box.style.border = "var(--wt-draw-border)";
    _box.style.background = "var(--wt-draw-bg)";
    _box.style.pointerEvents = "none";

    overlay.getAnnotationLayerElement().appendChild(_box);
  }


  /**
   * Handles mousemove during box drawing
   * Updates temporary box dimensions to follow cursor
   */
  function onMouseMove(e) {
    if (!isDrawing() || !_isDragging || !_box) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = overlay.getOverlayElement().getBoundingClientRect();

    // Current mouse position in overlay space
    _endX = e.clientX - rect.left;
    _endY = e.clientY - rect.top;

    // Normalize for drawing in any direction
    const left = Math.min(_startX, _endX);
    const top = Math.min(_startY, _endY);
    const width = Math.abs(_endX - _startX);
    const height = Math.abs(_endY - _startY);

    _box.style.left = left + "px";
    _box.style.top = top + "px";
    _box.style.width = width + "px";
    _box.style.height = height + "px";
  }


  /**
   * Handles mouseup to finish drawing box
   * Either adds box to new annotation (prompts for WT ID) or existing annotation
   */
  async function onMouseUp(e) {
    if (!isDrawing() || !_isDragging || !_box) return;

    e.preventDefault();
    e.stopPropagation();

    _isDragging = false;

    const rect = overlay.getOverlayElement().getBoundingClientRect();
    const vp = archiveProvider.getCurrentViewport();
    if (!vp) return;

    // STEP 1: Convert overlay pixels to image space
    // Formula: imageCoord = viewport.origin + (screenPixel / screenSize) * viewport.size
    const x1 = vp.x + (_startX / rect.width) * vp.w;
    const y1 = vp.y + (_startY / rect.height) * vp.h;
    const x2 = vp.x + (_endX / rect.width) * vp.w;
    const y2 = vp.y + (_endY / rect.height) * vp.h;

    // STEP 2: Normalize rectangle in image space
    const newFrame = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    };

    const annotation = annotationsAPI.getAnnotationByWtId(_activeDrawingPerson);
    if (annotation) {
      // Case 1: Adding box to existing annotation

      annotation.frames.push(newFrame);

      await annotationsAPI.updateExistingAnnotation(annotation.wikitreeid, { frames: annotation.frames });
      overlay.renderAnnotations();

      _box.remove();
      _box = null;
   
      return;

    } else {
      // Case 2: Creating new annotation
      const key = archiveProvider.getCurrentPageKey();
      const annotation = {
        site: key.site,
        book: key.book,
        page: key.page,
        reference: await archiveProvider.getReferenceFromPage(),
        frames: [newFrame],
        wikitreeid: _activeDrawingPerson,
        note: null, 
        wtIdFound: await personAPI.prefetch(_activeDrawingPerson) // pre-fetch person data for this ID
      };
/*
      // Prompt user for WikiTree ID
      ui.openWtEditor({
        x: e.clientX,
        y: e.clientY,
        initialValue: incomingWtId ? incomingWtId : "",
        initialNote: "",
        onSave: async ({wtId, note}) => {
          annotation.wtId = wtId;
          annotation.note = note;
          annotation.wtIdFound = 
          await annotationsAPI.addAnnotation(annotation);
          incomingWtId = null;    // clear this to avoid prefilling the editor after the first time
          _box.remove();
          _box = null;
        },
        onCancel: () => {
          _box.remove();
          _box = null;
        }
      }); */

      await annotationsAPI.addAnnotation(annotation);
      _box.remove();
      _box = null;

      tools.clearActiveDrawingPerson();
      tools.setTool(null);
      ui.updateToolUI();
    }
  }

  
  // ============================================================
  // EDITING ANNOTATIONS
  // ============================================================

  /**
   * Opens editor to modify WT ID and note for an existing annotation
   * @param {string} id - Annotation ID
   * @param {number} screenX - Screen X position for dialog
   * @param {number} screenY - Screen Y position for dialog
   */
  function editAnnotation(id, screenX, screenY) {
    const annotation = annotationsAPI.getAnnotationById(id);
    if (!annotation) return;
  
    ui.openWtEditor({
      x: screenX,
      y: screenY,
      initialValue: annotation.wtId || "",
      initialNote: annotation.note || "",

      onSave: async ({wtId, note}) => {
        if (wtId !== annotation.wtId) {
          annotation.wtId = wtId;
          annotation.wtIdFound = await personAPI.prefetch(annotation.wtId);
        }
        annotation.note = note;

        await annotationsAPI.updateExistingAnnotation(annotation.id, 
          { wtId: annotation.wtId, 
            note: annotation.note });
        overlay.renderAnnotations();
      }
    });
  }


  /**
   * Switch between tools (draw/select) with toggle behavior
   * When switching away from "select", clears selection
   * @param {string} nextTool - Tool to switch to: "draw" | "select"
   */
  function setTool(nextTool) {
    const prevTool = _currentTool;
  
    // Toggle behavior: clicking same tool twice turns it off
    _currentTool = (_currentTool === nextTool) ? null : nextTool;

    // Clean up when leaving select mode
    if (prevTool === "select" && _currentTool !== "select") {
      clearSelection();
      ui.closeWtEditor();
    }

    overlay.setDrawingState(isDrawing());

    // Auto-show annotations when entering draw mode
    if (!overlay.isVisible() && isDrawing()) {
      overlay.setVisible(true);
    }
  }

  // ============================================================
  // RESIZING ANNOTATION BOXES
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
        _startResize(e, box, corner);
      });

      box.appendChild(handle);
    });
  }


  /**
   * Initiates resize drag from a handle
   * Saves initial state and sets up event listeners
   * @param {MouseEvent} e - mousedown event
   * @param {HTMLElement} frameEl - Annotation frame element
   * @param {string} corner - Corner identifier (nw|ne|sw|se)
   */
  function _startResize(e, frameEl, corner) {
    const id = frameEl.dataset.annotationId;
    const annotation = annotationsAPI.getAnnotationById(id);
    if (!annotation) return;

    const frameIndex = Number(frameEl.dataset.boxIndex);
    const frame = annotation.frames[frameIndex];

    const rect = overlay.getOverlayElement().getBoundingClientRect();
  
    _resizing = {
      id,
      frameIndex,
      corner,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      startFrame: { ...frame }  // Save original for delta calculations
    };

    document.addEventListener("mousemove", _onResizeMove);
    document.addEventListener("mouseup", _stopResize);
  }


  /**
   * Handles mousemove during resize drag
   * Converts screen deltas to image space and updates box dimensions
   * @param {MouseEvent} e - mousemove event
   */
  function _onResizeMove(e) {
    if (!_resizing) return;

    const rect = overlay.getOverlayElement().getBoundingClientRect();
    const vp = archiveProvider.getCurrentViewport();

    // STEP 1: Compute mouse delta in overlay (screen) space
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const dx = currentX - _resizing.startX;
    const dy = currentY - _resizing.startY;

    // STEP 2: Convert delta to image space
    // The scale factor relates overlay pixels to image coordinates
    const scaleX = vp.w / rect.width;
    const scaleY = vp.h / rect.height;

    const dxImg = dx * scaleX;
    const dyImg = dy * scaleY;

    // STEP 3: Apply delta to annotation box in image space
    const annotation = annotationsAPI.getAnnotationById(_resizing.id);
    if (!annotation) return;

    const frame = annotation.frames[_resizing.frameIndex];

    // Start from original coordinates
    let { x, y, w, h } = _resizing.startFrame;
    const corner = _resizing.corner;

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
    frame.x = x;
    frame.y = y;
    frame.w = w;
    frame.h = h;

    overlay.renderAnnotations();
  }

  
  /**
   * Finalizes resize drag and saves changes
   */
  function _stopResize() {
    if (!_resizing) return;

    annotationsAPI.saveAnnotationsForPage();

    _resizing = null;

    document.removeEventListener("mousemove", _onResizeMove);
    document.removeEventListener("mouseup", _stopResize);
  }

  
  window.tools = {
    setTool,
    getTool,
    isDrawing,
    isSelecting,
    setActiveDrawingPerson,
    clearActiveDrawingPerson,
    selectAnnotation,
    clearSelection,
    addResizeHandles,
    getSelectedAnnotationId,
    getActiveFrameIndex,
    editAnnotation,
    onMouseDown,
    onMouseMove,
    onMouseUp
  }
})();

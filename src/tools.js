(() => {

  "use strict";

  const svgNS = "http://www.w3.org/2000/svg";

  let _currentTool = null;               // Active tool: null | "draw" | "edit"
  function getTool() {
    return _currentTool;
  }
  function isDrawing() {
    return _currentTool === "draw";
  }
  function isSelecting() {
    return _currentTool === "edit";
  }


  let _selectedAnnotationId = null;      // Currently selected annotation (for editing/resizing)
  function getSelectedAnnotationId() {
    return _selectedAnnotationId;
  }


  let _activeFrameIndex = null;            // Index of selected frame
  function getActiveFrameIndex() {
    return _activeFrameIndex;
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
   * @param {number} index - Index of the frame within the annotation
   */
  function selectAnnotation(id, index) {
    // Save changes from previously selected frame
    if (_selectedAnnotationId && (_selectedAnnotationId !== id)) {
      annotationsAPI.updateAnnotation(_selectedAnnotationId);
    }
    _selectedAnnotationId = id;
    _activeFrameIndex = index;
    overlay.updateSelectionStyles();
  }


  /**
   * Clears current selection and closes any open dialogs
   * Counterpart to selectAnnotation()
   */
  function clearSelection() {
    // Save changes from previously selected frame
    if (_selectedAnnotationId) {
      annotationsAPI.updateAnnotation(_selectedAnnotationId);
    }
    _selectedAnnotationId = null;
    _activeFrameIndex = null;
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

    // Create temporary visual feedback box using the SVG Namespace
    _box = document.createElementNS(svgNS, "rect");

    // Instead of inline absolute layout properties, assign classes or SVG-specific styles
    _box.setAttribute("class", "wt-drawing-feedback");
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

    _box.setAttribute("x", left);
    _box.setAttribute("y", top);
    _box.setAttribute("width", width);
    _box.setAttribute("height", height);
  }


  /**
   * Handles mouseup to finish drawing box
   * Either adds box to new annotation (prompts for WT ID) or existing annotation
   */
  async function onMouseUp(e) {
    if (!isDrawing() || !_isDragging || !_box) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore extra click 
    overlay.ignoreNextClick();

    _isDragging = false;

    // Convert screen pixels to image space coordinates
    const imagePoints = await archiveProvider.unprojectScreenPoints([
        { x: _startX, y: _startY },
        { x: _endX,   y: _startY },
        { x: _endX,   y: _endY },
        { x: _startX, y: _endY }
    ]);

    // Convert image points to bounding box (xywh)
    const frameLeft = Math.min(...imagePoints.map(p => p.x));
    const frameTop = Math.min(...imagePoints.map(p => p.y));
    const frameWidth = Math.max(...imagePoints.map(p => p.x)) - frameLeft;
    const frameHeight = Math.max(...imagePoints.map(p => p.y)) - frameTop;

    const newFrame = {
      frameid: null, 
      x: frameLeft,
      y: frameTop,
      w: frameWidth,
      h: frameHeight,
      note: null,
      _dirty: true
    };

    _box.remove();
    _box = null;

    // Set up to have the frame be selected in case of further editing
    _selectedAnnotationId = _activeDrawingPerson;
    _activeFrameIndex = await annotationsAPI.addFrame(_activeDrawingPerson, newFrame);
    clearActiveDrawingPerson();
    setTool("edit");
    ui.updateToolUI();
  }

  
  // ============================================================
  // EDITING ANNOTATIONS
  // ============================================================

  /**
   * Opens editor to modify note for an existing annotation
   * @param {string} id - Annotation ID (WikiTree ID)
   * @param {number} frameIndex - Index of the frame to edit
   * @param {number} screenX - Screen X position for dialog
   * @param {number} screenY - Screen Y position for dialog
   */
  function editFrame(id, frameIndex, screenX, screenY) {
    const annotation = annotationsAPI.getAnnotationByWtId(id);
    if (!annotation) return;

    const frameData = annotation.frames[frameIndex];

    ui.openWtEditor({
      x: screenX,
      y: screenY,
      initialNote: frameData.note || "",

      onSave: async ({note}) => {
        frameData.note = note;

        // Mark this frame as having unsaved changes
        frameData._dirty = true;

        overlay.renderAnnotations();
      }
    });
  }


  /**
   * Switch between tools (draw/edit) with toggle behavior
   * When switching away from "edit", clears selection
   * @param {string} nextTool - Tool to switch to: "draw" | "edit"
   */
  function setTool(nextTool) {
    const prevTool = _currentTool;
  
    // Toggle behavior: clicking same tool twice turns it off
    _currentTool = (_currentTool === nextTool) ? null : nextTool;

    // Clean up when leaving select mode
    if (prevTool === "edit" && _currentTool !== "edit") {
      if (_activeDrawingPerson !== _selectedAnnotationId) clearSelection();
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
   * @param {SVGPolygonElement} box - Annotation box SVG polygon element
   * @param {string} id - Annotation ID
   */
  function addResizeHandles(box, id) {
    const corners = ["nw", "ne", "sw", "se"];
  
    // Extract the raw points array directly from the polygon attributes
    // e.g., ["x1,y1", "x2,y2", "x3,y3", "x4,y4"]
    const points = box.getAttribute("points").split(" ").map(p => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });
  
    // Map points to corners safely based on the polygon's wound order:
    const cornerMapping = {
      nw: points[0],
      ne: points[1],
      se: points[2],
      sw: points[3]
    };

    const group = document.createElementNS(svgNS, "g");
    group.classList.add("resize-handle-group");
    group.dataset.annotationId = id;
    group.dataset.frameIndex = box.dataset.frameIndex;

    corners.forEach(corner => {
      const pt = cornerMapping[corner];
      if (!pt) return;

      // Create an SVG circle for the handle
      const handle = document.createElementNS(svgNS, "circle");
      handle.setAttribute("cx", pt.x);
      handle.setAttribute("cy", pt.y);
      handle.setAttribute("r", "5"); // 5px radius handle
      handle.setAttribute("class", `resize-handle ${corner}`);
    
      handle.dataset.corner = corner;
      handle.dataset.annotationId = id;
      handle.dataset.frameIndex = box.dataset.frameIndex;

      handle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        _startResize(e, box, corner); 
      });
      group.appendChild(handle);
    });
    // Append to the parent SVG layer, not inside the polygon
    box.parentNode.appendChild(group);
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
    const annotation = annotationsAPI.getAnnotationByWtId(id);
    if (!annotation) return;

    const frameIndex = Number(frameEl.dataset.frameIndex);
    const frame = annotation.frames[frameIndex];

    const { x, y, w, h } = frame;
  
    const corners = {
      nw: { x: x,     y: y     },
      ne: { x: x + w, y: y     },
      sw: { x: x,     y: y + h },
      se: { x: x + w, y: y + h }
    };

    // Lookup table
    const oppositeCorners = {
      nw: "se",
      ne: "sw",
      se: "nw",
      sw: "ne"
    };

    _resizing = {
      id,
      frameIndex,
      fixedCorner:  corners[oppositeCorners[corner]]
    };

    // Prevent text selection during drag
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    document.addEventListener("mousemove", _onResizeMove);
    document.addEventListener("mouseup", _stopResize);
  }


  /**
   * Handles mousemove during resize drag
   * Converts screen deltas to image space and updates box dimensions
   * @param {MouseEvent} e - mousemove event
   */
  async function _onResizeMove(e) {
    if (!_resizing) return;
    const rect = overlay.getOverlayElement().getBoundingClientRect();
    
    const [imagePoint] = await archiveProvider.unprojectScreenPoints([
      {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    ]);
    
    const fixed = _resizing.fixedCorner;
    const moving = imagePoint;

    // STEP 3: Apply delta to annotation box in image space
    const annotation = annotationsAPI.getAnnotationByWtId(_resizing.id);
    if (!annotation) return;

    const frame = annotation.frames[_resizing.frameIndex];

    frame.x = Math.min(fixed.x, moving.x);
    frame.y = Math.min(fixed.y, moving.y);
    frame.w = Math.abs(moving.x - fixed.x);
    frame.h = Math.abs(moving.y - fixed.y);

    // Enforce minimum box size
    frame.w = Math.max(20, frame.w);
    frame.h = Math.max(20, frame.h);

    // Mark this frame as needing to be saved
    frame._dirty = true;

    overlay.renderAnnotations();
  }


  /**
   * Finalizes resize drag and cleans up
   */
  function _stopResize() {
    if (!_resizing) return;

    _resizing = null;

    // Restore text selection
    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";

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
    editFrame,
    onMouseDown,
    onMouseMove,
    onMouseUp
  }
})();

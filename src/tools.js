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
  function getActiveDrawingPerson() {
    return _activeDrawingPerson;
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
  let _rotating = null;


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
    // We shouldn't be switching from one annotation to another via this routine.  
    if (_selectedAnnotationId && (_selectedAnnotationId !== id)) {
      console.warn("Changing selection from one annotation to another without cleanly de-selecting the first.");
    }
    _selectedAnnotationId = id;
    _activeFrameIndex = index;
    ui.setToolbarMode("edit");
    overlay.renderAnnotations();
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
    setTool(null);
    ui.setToolbarMode("normal");
  }


  function cancelChanges() {
    if (_selectedAnnotationId) {
      annotationsAPI.cancelAnnotationChanges(_selectedAnnotationId);
    }
    _selectedAnnotationId = null;
    _activeFrameIndex = null;
    ui.closeWtEditor();
    setTool(null);
    ui.setToolbarMode("normal");
    overlay.renderAnnotations();
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
    if (_activeDrawingPerson) _selectedAnnotationId = _activeDrawingPerson;
    _activeFrameIndex = await annotationsAPI.addFrame(_selectedAnnotationId, newFrame);
    clearActiveDrawingPerson();
    setTool("edit");
    ui.setToolbarMode("edit");
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
        annotationsAPI.ensureUndoSnapshot(id);

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
  // RESIZING and ROTATING ANNOTATION BOXES
  // ============================================================

  function addManipulationHandles(box, wtId) {
    _addResizeHandles(box, wtId);
    _addRotateHandle(box, wtId); 
  }


  /**
   * Creates corner resize handles (nw, ne, sw, se) on selected box
   * @param {SVGPolygonElement} box - Annotation box SVG polygon element
   * @param {string} id - Annotation ID
   */
  function _addResizeHandles(box, id) {
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

    annotationsAPI.ensureUndoSnapshot(id);

    const frameIndex = Number(frameEl.dataset.frameIndex);
    const frame = annotation.frames[frameIndex];

    // Get world coordinates for all rotated corners using your helper
    const unmappedCorners = getRotatedRectangle(frame);
    const corners = {
      nw: unmappedCorners[0],
      ne: unmappedCorners[1],
      se: unmappedCorners[2],
      sw: unmappedCorners[3]
    };

    const oppositeCorners = {
      nw: "se",
      ne: "sw",
      se: "nw",
      sw: "ne"
    };

    _resizing = {
      id,
      frameIndex,
      draggedCorner: corner,
      // Store fixed corner position in world space
      fixedCorner: corners[oppositeCorners[corner]]
    };

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    document.addEventListener("mousemove", _onResizeMove);
    document.addEventListener("mouseup", _stopResize);
  }


  async function _onResizeMove(e) {
    if (!_resizing) return;

    const rect = overlay.getOverlayElement().getBoundingClientRect();
    const [movingWorld] = await archiveProvider.unprojectScreenPoints([
      {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    ]);

    const annotation = annotationsAPI.getAnnotationByWtId(_resizing.id);
    if (!annotation) return;

    const frame = annotation.frames[_resizing.frameIndex];
    const angle = frame.a || 0; 
    const fixedWorld = _resizing.fixedCorner;

    // STEP 1: Un-rotate the mouse vector relative to the fixed corner
    const dx = movingWorld.x - fixedWorld.x;
    const dy = movingWorld.y - fixedWorld.y;

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // STEP 2: Calculate new dimensions enforcing min dimensions 
    // (Preserves direction sign before taking absolute size)
    const MIN_SIZE = 20;
  
    // Calculate raw width/height relative to fixed corner
    let rawW = Math.abs(localX);
    let rawH = Math.abs(localY);

    // Enforce minimum size while honoring mouse direction
    const signX = localX >= 0 ? 1 : -1;
    const signY = localY >= 0 ? 1 : -1;

    if (rawW < MIN_SIZE) rawW = MIN_SIZE;
    if (rawH < MIN_SIZE) rawH = MIN_SIZE;

    // Re-apply direction signs to account for minimum clamps
    const effectiveLocalX = rawW * signX;
    const effectiveLocalY = rawH * signY;

    // STEP 3: Dynamically locate the local NW corner relative to fixed corner
    // The local NW corner is always the minimum local X and minimum local Y coordinates
    const localNW = {
      x: Math.min(0, effectiveLocalX),
      y: Math.min(0, effectiveLocalY)
    };

    // STEP 4: Rotate localNW back into World Space to set frame.x and frame.y
    const cosRot = Math.cos(angle);
    const sinRot = Math.sin(angle);

    frame.x = fixedWorld.x + (localNW.x * cosRot - localNW.y * sinRot);
    frame.y = fixedWorld.y + (localNW.x * sinRot + localNW.y * cosRot);
    frame.w = rawW;
    frame.h = rawH;

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


  function _addRotateHandle(box, wtId) {
    const group = document.createElementNS(svgNS, "g");
    group.classList.add("rotate-handle-group");
    group.dataset.annotationId = wtId;
    group.dataset.frameIndex = box.dataset.frameIndex;

    const points = box.getAttribute("points").split(" ").map(p => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });

    // Compute the angle of the line for the handle
    const nw = points[0];
    const se = points[2];
    const dx = se.x - nw.x;
    const dy = se.y - nw.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;

    // Length of the line
    const extension = Math.max(25, Math.min(50, len * 0.2));

    // End of the line
    const handleX = se.x + ux * extension;
    const handleY = se.y + uy * extension;

    // Draw the line
    const line = document.createElementNS(svgNS, "line");

    line.setAttribute("x1", se.x);
    line.setAttribute("y1", se.y);
    line.setAttribute("x2", handleX);
    line.setAttribute("y2", handleY);

    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "2");

    // Draw the circular handle
    const circle = document.createElementNS(svgNS, "circle");
    circle.classList.add("rotate-handle");

    circle.setAttribute("cx", handleX);
    circle.setAttribute("cy", handleY);
    circle.setAttribute("r", "12");

    circle.setAttribute("fill", "white");
    circle.setAttribute("stroke", "black");
    circle.setAttribute("stroke-width", "2");

    // Add the icon
    const icon = document.createElementNS(svgNS, "text");

    icon.setAttribute("x", handleX);
    icon.setAttribute("y", handleY);

    icon.setAttribute("text-anchor", "middle");
    icon.setAttribute("dominant-baseline", "central");

    icon.style.fontSize = "16px";
    icon.style.userSelect = "none";

    icon.textContent = "↺";
    icon.style.pointerEvents = "none";

    // Add the tooltip
    const title = document.createElementNS(svgNS, "title");
    title.textContent = "Tilt frame";

    circle.appendChild(title);

    group.appendChild(line);
    group.appendChild(circle);
    group.appendChild(icon);

    circle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      _startRotate(e, box); 
    });

    // Append to the parent SVG layer, not inside the polygon
    box.parentNode.appendChild(group);

  }
  

  async function _startRotate(e, box) {
    e.preventDefault();
    e.stopPropagation();

    const id = box.dataset.annotationId;
    const frameIndex = Number(box.dataset.frameIndex);

    const annotation = annotationsAPI.getAnnotationByWtId(id);
    const frame = annotation.frames[frameIndex];

    // Save undo snapshot if needed
    annotationsAPI.ensureUndoSnapshot(id);

    // Retrieve the pivot (upper-left corner)
    const pivot = {
      x: frame.x,
      y: frame.y
    };

    // Convert mouse position to be relative to the viewer element
    const rect = overlay.getOverlayElement().getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const mousePt = await archiveProvider.unprojectScreenPoints([{x, y}]);

    // Initial mouse angle
    const startAngle = Math.atan2(
      mousePt[0].y - pivot.y,
      mousePt[0].x - pivot.x
    );

    _rotating = {
      annotationId: id,
      frameIndex,
      pivot,
      startAngle,
      initialRotation: frame.a || 0
    };

    document.addEventListener("mousemove", _onRotateMove);
    document.addEventListener("mouseup", _stopRotate);
  }


  async function _onRotateMove(e) {
    // Convert mouse position to be relative to the viewer element
    const rect = overlay.getOverlayElement().getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const mousePt = await archiveProvider.unprojectScreenPoints([{x, y}]);

    const angle = Math.atan2(
      mousePt[0].y - _rotating.pivot.y,
      mousePt[0].x - _rotating.pivot.x
    );

    const delta = angle - _rotating.startAngle;

    const annotation = annotationsAPI.getAnnotationByWtId(_rotating.annotationId);
    const frame = annotation.frames[_rotating.frameIndex];
    
    // Limit rotation to +/- pi/2 (90 degrees)
    const halfPi = Math.PI / 2;
    const newAngle = _rotating.initialRotation + delta;
    // Shift range, apply modulo, and shift back
    frame.a = Math.max(-halfPi, Math.min(halfPi, newAngle));

    // Mark this frame as needing to be saved
    frame._dirty = true;

    overlay.renderAnnotations();
  }


  function _stopRotate() {
    if (!_rotating) return;

    const annotation = annotationsAPI.getAnnotationByWtId(_rotating.annotationId);
    const frame = annotation.frames[_rotating.frameIndex];

    if (frame.a === Math.PI / 2) {
      const newX = frame.x - frame.h;
      //const newY = frame.y;
      const newW = frame.h;
      const newH = frame.w;

      frame.x = newX;
      frame.w = newW;
      frame.h = newH;
      delete frame.a;

      overlay.renderAnnotations();

    } else if (frame.a === -Math.PI / 2) {
      //const newX = frame.x;
      const newY = frame.y - frame.w;
      const newW = frame.h;
      const newH = frame.w;

      frame.y = newY;
      frame.w = newW;
      frame.h = newH;
      delete frame.a;

      overlay.renderAnnotations();
    }

    _rotating = null;

    // Restore text selection
    //document.body.style.userSelect = "";
    //document.body.style.webkitUserSelect = "";

    document.removeEventListener("mousemove", _onRotateMove);
    document.removeEventListener("mouseup", _stopRotate);

  }


  function getRotatedRectangle(frameData) {
    // Default angle to 0 if it's not present
    const { x, y, w, h, a = 0 } = frameData;

    // Optimization: Return unrotated corners instantly
    if (a === 0) {
        return [
            { x: x,     y: y },
            { x: x + w, y: y },
            { x: x + w, y: y + h },
            { x: x,     y: y + h }];
    }

    // Pre-calculate trigonometry
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // Top-Left corner (Pivot)
    const x0 = x;
    const y0 = y;

    // Top-Right corner
    const x1 = x + w * cos;
    const y1 = y + w * sin;

    // Bottom-Right corner
    const x2 = x + w * cos - h * sin;
    const y2 = y + w * sin + h * cos;

    // Bottom-Left corner
    const x3 = x - h * sin;
    const y3 = y + h * cos;

    return [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 }];
  }



  window.tools = {
    setTool,
    getTool,
    isDrawing,
    isSelecting,
    setActiveDrawingPerson,
    getActiveDrawingPerson,
    clearActiveDrawingPerson,
    selectAnnotation,
    clearSelection,
    cancelChanges,
    addManipulationHandles,
    getSelectedAnnotationId,
    getActiveFrameIndex,
    editFrame,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    getRotatedRectangle
  }
})();

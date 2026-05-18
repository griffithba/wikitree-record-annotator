(() => {

  let currentTool = null;               // Active tool: null | "draw" | "select"
  
  function getTool() {
    return currentTool;
  }

  function isDrawing() {
    return currentTool === "draw";
  }

  function isSelecting() {
    return currentTool === "select";
  }

  function isAddingBoxToAnnotationId() {
    return addingBoxToAnnotationId;
  }

  // Display and selection state
  let selectedAnnotationId = null;      // Currently selected annotation (for editing/resizing)
  let activeBoxIndex = null;            // Index of selected box

  function getSelectedAnnotationId() {
    return selectedAnnotationId;
  }

  function getActiveBoxIndex() {
    return activeBoxIndex;
  }

  let addingBoxToAnnotationId = null;   // Non-null when adding box to existing annotation

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
    selectedAnnotationId = id;
    activeBoxIndex = index;
    overlay.updateSelectionStyles();
  }

  /**
   * Clears current selection and closes any open dialogs
   * Counterpart to selectAnnotation()
   */
  function clearSelection() {
    selectedAnnotationId = null;
    activeBoxIndex = null;
    addingBoxToAnnotationId = null;
    overlay.updateSelectionStyles();
    ui.closeWtEditor();
  }


  // ============================================================
  // SECTION 9: MOUSE HANDLERS (DRAWING BOXES)
  // ============================================================

  /**
   * Handles mousedown to start drawing a new box
   * Creates temporary DOM element that follows mouse
   */
  function onMouseDown(e) {
    if (isDrawing() && !isAddingBoxToAnnotationId()) return;

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
    if ((isDrawing() && !addingBoxToAnnotationId) || !isDragging || !box) return;

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
    if ((isDrawing() && !addingBoxToAnnotationId) || !isDragging || !box) return;

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
        page: getCurrentPageKey(),
        source: sourceSite,
        url: getCleanPageUrl(),
        reference: await getReferenceFromPage(),
        boxes: [newBox],
        wtId: null,
        note: null, 
        wtIdFound: null
      };

      // Prompt user for WikiTree ID
      ui.openWtEditor({
        x: e.clientX,
        y: e.clientY,
        initialValue: preFillWtIdOnCreate ? incomingWtId : "",
        initialNote: "",
        onSave: async ({wtId, note}) => {
          annotation.wtId = wtId;
          annotation.note = note;
          annotation.wtIdFound = await personAPI.prefetch(wtId); // pre-fetch person data for this ID
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

        await annotationsAPI.saveAnnotationsForPage(annotations);
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
    const prevTool = currentTool;
  
    // Toggle behavior: clicking same tool twice turns it off
    currentTool = (currentTool === nextTool) ? null : nextTool;

    // Clean up when leaving select mode
    if (prevTool === "select" && currentTool !== "select") {
      clearSelection();
      ui.closeWtEditor();
    }

    overlay.setDrawingState(isDrawing());

    // Update overlay interaction
    //overlay.style.pointerEvents = isDrawing() ? "auto" : "none";
    //overlay.style.cursor = isDrawing() ? "crosshair" : "default";

    // Auto-show annotations when entering draw mode
    if (!overlay.isVisible() && isDrawing()) {
      overlay.setVisible(true);
    }

    // Visual feedback: tint overlay only in draw mode
    //overlay.style.background = isDrawing() ? "var(--wt-draw-overlay-bg)" : "transparent";
    //overlay.style.border = isDrawing() ? "var(--wt-draw-overlay-border)" : "none";
  }

  window.tools = {
    setTool,
    getTool,
    isDrawing,
    isSelecting,
    isAddingBoxToAnnotationId,
    selectAnnotation,
    clearSelection,
    getSelectedAnnotationId,
    getActiveBoxIndex,
    onMouseDown,
    onMouseMove,
    onMouseUp
  }
})();

(() => {

  // Transparent interaction layer (captures mouse input)
  const overlay = document.createElement("div");
  overlay.id = "wt-overlay";

  // Visual layer for rendered annotations
  const annotationLayer = document.createElement("div");
  annotationLayer.id = "wt-annotation-layer";

  let container = null;

  function initialize(viewerContainer) {

    container = viewerContainer;

    container.style.position = "relative";
  }

  function getContainer() {
    return container;
  }


  let renderInProgress = false;

  let visible = true;

  function setVisible(v) {
    visible = v;
    renderAnnotations();
  }

  function isVisible() {
    return visible;
  }


  function setDrawingState(enabled) {

    overlay.style.pointerEvents =
      enabled ? "auto" : "none";

    overlay.style.cursor =
      enabled ? "crosshair" : "default";

    overlay.style.background =
      enabled
        ? "var(--wt-draw-overlay-bg)"
        : "transparent";

    overlay.style.border =
      enabled
        ? "var(--wt-draw-overlay-border)"
        : "none";
  }

  /**
   * Updates visual styles for all annotation boxes based on selection state
   * Shows/hides toolbar and resize handles as needed
   */
  function updateSelectionStyles() {
    document.querySelectorAll(".wt-annotation").forEach(box => {
      const id = box.dataset.annotationId;
      let toolbar = box.querySelector(".annotation-toolbar");
       
      if (String(id) === String(tools.getSelectedAnnotationId())) {
        box.classList.add("wt-selected");
        if (!toolbar) {
          if (tools.getActiveBoxIndex() === Number(box.dataset.boxIndex)) {
            toolbar = ui.createAnnotationToolbar(id);
            box.appendChild(toolbar);
          } 
          addResizeHandles(box, id);
        } else if (tools.getActiveBoxIndex() !== Number(box.dataset.boxIndex)) {
            toolbar?.remove();
        }
      } else {
        box.classList.remove("wt-selected");
        toolbar?.remove();
        box.querySelectorAll(".resize-handle").forEach(h => h.remove());
      }
    });
  }

  
  function createLayers() {
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

  function attachEvents() {
    // Attach mouse event handlers
    overlay.addEventListener("mousedown", tools.onMouseDown);
    overlay.addEventListener("mousemove", tools.onMouseMove);
    overlay.addEventListener("mouseup", tools.onMouseUp);

    // Container click: clear selection when clicking empty space
    container.addEventListener("click", (e) => {
      if (!tools.isSelecting() || tools.isAddingBoxToAnnotationId()) return;
    
      // If click was on an annotation, ignore
      if (e.target.closest(".wt-annotation")) return;

      tools.clearSelection();
    });
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

      if (!isVisible()) return;

      // Load annotations for current page if not yet loaded
      await annotationsAPI.loadAnnotationsIfNeeded();

      const vp = currentViewport;
      console.log("Rendering annotations with viewport:", vp);
      if (!vp) return;
console.log("Rendering annotations...");

      // Render each annotation's boxes
      annotationsAPI.getAnnotations().forEach(a => {
        a.boxes.forEach((boxData, index) => {
          renderBox(a, boxData, index);
        });
      });

      updateSelectionStyles();
      ui.updateToolUI();
  
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
    if (a.id === tools.getSelectedAnnotationId()) {
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

    // Track annotation ID and box index for toolbar/resize operations
    box.dataset.annotationId = a.id;
    box.dataset.boxIndex = index;

    // Click handler: select in select mode, or open WikiTree profile
    box.addEventListener("click", (e) => {
      if (tools.isSelecting()) {
        e.stopPropagation();
        const id = box.dataset.annotationId;
        const boxIndex = Number(box.dataset.boxIndex);
        tools.selectAnnotation(id, boxIndex);
        return;
      }

      if (tools.isDrawing()) return;

      // Default: click to open WikiTree profile
      if (a.wtId) {
        window.open(
          `https://www.wikitree.com/wiki/${encodeURIComponent(a.wtId)}`,
          "_blank"
        );
      }
    });

    box.addEventListener("mouseenter", () => {
      if (tools.isDrawing() || tools.isSelecting()) return;

      const id = box.dataset.annotationId;

      document
        .querySelectorAll(
          `[data-annotation-id="${id}"]`
        )
        .forEach(el => {
          el.classList.add("wt-hover");
        });
    });

    box.addEventListener("mouseleave", () => {
      if (tools.isDrawing() || tools.isSelecting()) return;

      const id = box.dataset.annotationId;

      document
        .querySelectorAll(
          `[data-annotation-id="${id}"]`
        )
        .forEach(el => {
          el.classList.remove("wt-hover");
        });
    });
  
    if (!a.wtIdFound) {
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


  window.overlay = {
    initialize, 
    createLayers,
    attachEvents,
    setVisible,
    isVisible,
    renderAnnotations,
    setDrawingState,
    updateSelectionStyles
  };

})();

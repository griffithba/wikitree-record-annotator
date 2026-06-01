
(() => {

  "use strict";

  // Transparent interaction layer (captures mouse input)
  const _overlay = document.createElement("div");
  _overlay.id = "wt-overlay";
  function getOverlayElement() {
    return _overlay;
  }


  // Visual layer for rendered annotations
  const _annotationLayer = document.createElement("div");
  _annotationLayer.id = "wt-annotation-layer";
  function getAnnotationLayerElement() {
    return _annotationLayer;
  }


  let _container = null;

  function initialize(viewerContainer) {
    _container = viewerContainer;
    _container.style.position = "relative";
  }

  function getContainer() {
    return _container;
  }


  let _renderInProgress = false;
  let _renderQueued = false;


  let _visible = true;

  function setVisible(v) {
    _visible = v;
    renderAnnotations();
  }

  function isVisible() {
    return _visible;
  }


  function setDrawingState(enabled) {

    _overlay.style.pointerEvents =
      enabled ? "auto" : "none";

    _overlay.style.cursor =
      enabled ? "crosshair" : "default";

    _overlay.style.background =
      enabled
        ? "var(--wt-draw-overlay-bg)"
        : "transparent";

    _overlay.style.border =
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
          tools.addResizeHandles(box, id);
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
    Object.assign(_annotationLayer.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none"
    });

    // Overlay layer: interaction capture, no visuals
    Object.assign(_overlay.style, {
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
    const host = _container.parentElement; 

    host.appendChild(_annotationLayer);
    host.appendChild(_overlay);
  }


  function attachEvents() {
    // Attach mouse event handlers
    _overlay.addEventListener("mousedown", tools.onMouseDown);
    _overlay.addEventListener("mousemove", tools.onMouseMove);
    _overlay.addEventListener("mouseup", tools.onMouseUp);

    // Container click: clear selection when clicking empty space
    _container.addEventListener("click", (e) => {
      if (!tools.isSelecting() || tools.isAddingBoxToAnnotationId()) return;
    
      // If click was on an annotation, ignore
      if (e.target.closest(".wt-annotation")) return;

      tools.clearSelection();
    });
  }


  // ============================================================
  // RENDERING ANNOTATIONS
  // ============================================================

  /**
   * Main render loop for all annotations
   * Syncs viewport, clears previous render, renders all boxes
   */
  async function renderAnnotations() {
    console.count("renderAnnotations");
    if (_renderInProgress) {
      _renderQueued = true;
      return;
    }
    _renderInProgress = true;
    try {
      const _container = archiveProvider.getViewerContainer();
      if (!_container) return;

      // Always sync viewport first (prevents lag when zooming)
      archiveProvider.syncViewport();

      // Clear previous render
      while (_annotationLayer.firstChild) {
        _annotationLayer.removeChild(_annotationLayer.firstChild);
      }

      if (!isVisible()) return;

      // Load annotations for current page if not yet loaded
      await annotationsAPI.loadAnnotationsIfNeeded();

      const vp = archiveProvider.getCurrentViewport();
      if (!vp) return;

      // Render each annotation's boxes
      annotationsAPI.getAnnotations().forEach(a => {
        a.boxes.forEach((boxData, index) => {
          _renderBox(a, boxData, index);
        });
      });

      requestAnimationFrame(() => updateSelectionStyles());
      requestAnimationFrame(() => ui.updateToolUI());
  
    } finally {
      _renderInProgress = false;

      // If a render was requested while one was in progress, queue up another render to run immediately after
      // This handles the case where an initial momentary bogus viewport causes a render with incorrect coordinates.
      if (_renderQueued) {
        _renderQueued = false;
        requestAnimationFrame(renderAnnotations);
      }
    }
  }


  /**
   * Renders a single annotation box on screen
   * Converts image space coordinates to screen pixels
   * @param {Object} a - Annotation object
   * @param {Object} boxData - Box coordinates {x, y, w, h} in image space
   * @param {number} index - Box index within annotation
   */
  function _renderBox(a, boxData, index) {
    const vp = archiveProvider.getCurrentViewport();
    const rect = _overlay.getBoundingClientRect();

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
      box.title = _buildTooltip(a);

      // Highlight if this annotation matches incoming profile
      if (String(a.wtId) === String(incomingWtId)) {
        _triggerRefHighlight(a.id);
        // don't prefill new annotations with the incoming WikiTree ID if there's
        // already one for that ID
        incomingWtId = null;
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
      _addInvalidBadge(box);
    } 

    _annotationLayer.appendChild(box);
  }


  /**
   * Builds HTML title/tooltip for an annotation
   * Format: "Name (birth-death)" or WikiTree ID
   * @param {Object} a - Annotation object
   * @returns {string} Tooltip text
   */
  function _buildTooltip(a) {
    let text = a.wtId;

    if (a.wtIdFound) {
      const person = personAPI.getCached(a.wtId);

      if (person && (person.name || person.birth || person.death)) {
        const years = (person.birth || "") + "-" + (person.death || "");
        text = `${person.name || a.wtId} (${years})`;
      }
    } else {
      text += " not found";
    }
    
    if (a.note) {
      text += "\n" + a.note;
    }
    
    return text; 
  }

  
  function _addInvalidBadge(boxEl) {
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

  
  /**
   * Triggers pulse animation on annotation if it matches incoming WT profile
   * Only highlights each annotation once, not on every re-render
   * @param {string} annotationId - Annotation ID
   */
  function _triggerRefHighlight(annotationId) {
    function start() {
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


  window.overlay = {
    initialize, 
    getOverlayElement,
    getAnnotationLayerElement,
    createLayers,
    attachEvents,
    setVisible,
    isVisible,
    renderAnnotations,
    setDrawingState,
    updateSelectionStyles
  };

})();

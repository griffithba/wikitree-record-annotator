
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
   * Updates visual styles for all annotation frames based on selection state
   * Shows/hides toolbar and resize handles as needed
   */
  function updateSelectionStyles() {
    document.querySelectorAll(".wt-annotation").forEach(frame => {
      const id = frame.dataset.annotationId;
      let toolbar = frame.querySelector(".annotation-toolbar");
       
      if (String(id) === String(tools.getSelectedAnnotationId())) {
        frame.classList.add("wt-selected");
        if (!toolbar) {
          if (tools.getActiveFrameIndex() === Number(frame.dataset.frameIndex)) {
            toolbar = ui.createAnnotationToolbar(id);
            frame.appendChild(toolbar);
          } 
          tools.addResizeHandles(frame, id);
        } else if (tools.getActiveFrameIndex() !== Number(frame.dataset.frameIndex)) {
            toolbar?.remove();
        }
      } else {
        frame.classList.remove("wt-selected");
        toolbar?.remove();
        frame.querySelectorAll(".resize-handle").forEach(h => h.remove());
      }
    });
  }

  
  function createLayers() {
    // remove any stale overlays first
    document.getElementById("wt-overlay")?.remove();
    document.getElementById("wt-annotation-layer")?.remove();
    
    // Annotation layer: visual only, no interaction
    Object.assign(_annotationLayer.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "99998",
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
    const host = _container.parentElement; 
    host.addEventListener("click", (e) => {
      if (!tools.isSelecting()) return;
    
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
   * Syncs viewport, clears previous render, renders all frames
   */
  async function renderAnnotations() {
    if (_renderInProgress) {
      _renderQueued = true;
      return;
    }
    _renderInProgress = true;
    try {
      const _container = archiveProvider.getViewerContainer();
      if (!_container) return;

      // Clear previous render
      while (_annotationLayer.firstChild) {
        _annotationLayer.removeChild(_annotationLayer.firstChild);
      }

      if (!isVisible()) return;

      // Load annotations for current page if not yet loaded
      await annotationsAPI.loadAnnotationsIfNeeded();

      const vp = archiveProvider.getCurrentViewport();
      if (!vp) return;

      // Render each annotation's frames
      annotationsAPI.getAnnotations().forEach(a => {
        a.frames.forEach((frameData, index) => {
          _renderFrame(a, frameData, index);
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
   * Renders a single annotation frame on screen
   * Converts image space coordinates to screen pixels
   * @param {Object} a - Annotation object
   * @param {Object} frameData - Frame coordinates {x, y, w, h} in image space
   * @param {number} index - Frame index within annotation
   */
  function _renderFrame(a, frameData, index) {
    const vp = archiveProvider.getCurrentViewport();
    const rect = _overlay.getBoundingClientRect();

    // STEP 1: Convert image space → viewport-relative → screen pixels
    // viewport-relative: how far through the viewport is this coordinate?
    const relX = (frameData.x - vp.x) / vp.w;
    const relY = (frameData.y - vp.y) / vp.h;
    const relW = frameData.w / vp.w;
    const relH = frameData.h / vp.h;

    const frame = document.createElement("div");

    // STEP 2: Convert viewport-relative to screen pixels
    frame.style.position = "absolute";
    frame.style.left = (relX * rect.width) + "px";
    frame.style.top = (relY * rect.height) + "px";
    frame.style.width = (relW * rect.width) + "px";
    frame.style.height = (relH * rect.height) + "px";

    frame.className = "wt-annotation";

    // Add selection styling if needed
    if (a.id === tools.getSelectedAnnotationId()) {
      frame.classList.add("wt-selected");
    }

    // Set tooltip
    frame.title = personAPI.formatDisplayName(a.wikitreeid);
      
    // append note, if present
    if (frameData.note) {
      frame.title += "\n" + frameData.note;
    }

    // Highlight if this annotation matches incoming profile
    if (String(a.wikitreeid) === String(incomingWtId)) {
      _triggerRefHighlight(a.id);
      // don't prefill new annotations with the incoming WikiTree ID if there's
      // already one for that ID
      incomingWtId = null;
    }

    // Track annotation ID (WT ID) and frame index for toolbar/resize operations
    frame.dataset.annotationId = a.wikitreeid;
    frame.dataset.frameIndex = index;
    frame.dataset.frameId = frameData.frameid;

    // Click handler: select in select mode, or open WikiTree profile
    frame.addEventListener("click", (e) => {
      if (tools.isSelecting()) {
        e.stopPropagation();
        const id = frame.dataset.annotationId;
        const frameIndex = Number(frame.dataset.frameIndex);
        tools.selectAnnotation(id, frameIndex);
        return;
      }

      if (tools.isDrawing()) return;

      // Default: click to open WikiTree profile
      if (a.wikitreeid) {
        window.open(
          `https://www.wikitree.com/wiki/${encodeURIComponent(a.wikitreeid)}`,
          "_blank"
        );
      }
    });

    frame.addEventListener("mouseenter", () => {
      if (tools.isDrawing() || tools.isSelecting()) return;

      const id = frame.dataset.annotationId;

      document
        .querySelectorAll(
          `[data-annotation-id="${id}"]`
        )
        .forEach(el => {
          el.classList.add("wt-hover");
        });
    });

    frame.addEventListener("mouseleave", () => {
      if (tools.isDrawing() || tools.isSelecting()) return;

      const id = frame.dataset.annotationId;

      document
        .querySelectorAll(
          `[data-annotation-id="${id}"]`
        )
        .forEach(el => {
          el.classList.remove("wt-hover");
        });
    });
  
    if (!a.wtIdFound) {
      _addInvalidBadge(frame);
    } 

    _annotationLayer.appendChild(frame);
  }


  function _addInvalidBadge(frameEl) {
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

    frameEl.appendChild(badge);
  }

  
  /**
   * Triggers pulse animation on annotation if it matches incoming WT profile
   * Only highlights each annotation once, not on every re-render
   * @param {string} annotationId - Annotation ID
   */
  function _triggerRefHighlight(annotationId) {
    function start() {
      // Highlight ALL frames for this annotation
      requestAnimationFrame(() => {
        document.querySelectorAll(
          `[data-annotation-id="${annotationId}"]`
        ).forEach(frame => {
          frame.classList.add("wt-ref-highlight");
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

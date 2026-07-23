
(() => {

  "use strict";

  const svgNS = "http://www.w3.org/2000/svg";

  let _renderCount = 0;

  // Transparent interaction layer (captures mouse input)
  const _overlay = document.createElement("div");
  _overlay.id = "wt-overlay";
  function getOverlayElement() {
    return _overlay;
  }


  // Visual layer for rendered annotations
  const _annotationLayer = document.createElementNS(svgNS, "svg");

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


  let _visible = true;

  function setVisible(v) {
    _visible = v;
  }

  function isVisible() {
    return _visible;
  }


  let _ignoreClicksUntil = 0;

  function ignoreNextClick() {
    _ignoreClicksUntil = Date.now() + 100;
  }

  function _shouldIgnoreClick() {
    return Date.now() < _ignoreClicksUntil;
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
    const layer = overlay.getAnnotationLayerElement();

    const selectedId = tools.getSelectedAnnotationId();

    document.querySelectorAll(".wt-annotation").forEach(frame => {
      // Skip the loop if this element is an HTML toolbar
      if (frame.tagName.toLowerCase() !== "polygon") {
        return; 
      }
      const id = frame.dataset.annotationId;
      const frameIndex = frame.dataset.frameIndex;
      
      // Look for the toolbar container associated with this specific ID & frame index in the parent layer
      let toolbarWrapper = layer.querySelector(
        `foreignObject[data-annotation-id="${id}"][data-toolbar-for="${frameIndex}"]`
      );

      if (id === selectedId) {
        const annotation = annotationsAPI.getAnnotationByWtId(id);
        const frameData = annotation.frames[Number(frameIndex)];

        frame.classList.add("wt-selected");
        if (frameData?._dirty) {
          frame.classList.add("wt-unsaved-changes");
        }
        if (frameData?._delete) {
          frame.classList.add("wt-pending-delete");
        }

        if (!toolbarWrapper) {
          if (tools.getActiveFrameIndex() === Number(frameIndex)) {
            // 1. Calculate a bounding box from the polygon points to anchor the HTML toolbar
            const points = frame.getAttribute("points").split(" ").map(p => {
              const [x, y] = p.split(",").map(Number);
              return { x, y };
            });
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);

            const boxWidth = maxX - minX;
            const MIN_TOOLBAR_WIDTH = 120; 
            const toolbarWidth = Math.max(boxWidth, MIN_TOOLBAR_WIDTH);
            const xOffset = boxWidth < MIN_TOOLBAR_WIDTH ? (MIN_TOOLBAR_WIDTH - boxWidth) / 2 : 0;
            // 2. Create the foreignObject portal wrapper
            toolbarWrapper = document.createElementNS(svgNS, "foreignObject");
            toolbarWrapper.setAttribute("data-annotation-id", id);
            toolbarWrapper.setAttribute("data-toolbar-for", frameIndex);
            toolbarWrapper.setAttribute("x", minX - xOffset);
            // Place it right below the bottom edge of the frame
            toolbarWrapper.setAttribute("y", maxY + 5); 
            toolbarWrapper.setAttribute("width", toolbarWidth);
            toolbarWrapper.setAttribute("height", "50"); // Give the toolbar enough vertical room
            toolbarWrapper.style.overflow = "visible";

            // 3. Generate HTML toolbar and inject it
            const toolbar = ui.createAnnotationToolbar(id, frameIndex);

            // attach the datasets to the toolbar 
            // so e.target.closest(".wt-annotation") inside button actions can still resolve it!
            toolbar.className += " wt-annotation"; 
            toolbar.dataset.annotationId = id;
            toolbar.dataset.frameIndex = frameIndex;

            toolbarWrapper.appendChild(toolbar);
            layer.appendChild(toolbarWrapper);
            if (!frameData?._delete) {
              tools.addResizeHandles(frame, id);
            }
          } 
          
        } else if (tools.getActiveFrameIndex() !== Number(frameIndex)) {
          // Remove the toolbar and handles if this frame is not the active one
          toolbarWrapper?.remove();
          layer.querySelector(
            `.resize-handle-group[data-annotation-id="${id}"][data-frame-index="${frameIndex}"]`
          )?.remove();
        }
      } else {
        frame.classList.remove("wt-selected");
        
        const specificToolbar = layer.querySelector(`foreignObject[data-annotation-id="${id}"]`);
        specificToolbar?.remove();
        
        layer.querySelector(
          `.resize-handle-group[data-annotation-id="${id}"][data-frame-index="${frameIndex}"]`
        )?.remove();
      }
    });
  }
  

  function createLayers() {
    // remove any stale overlays first
    document.getElementById("wt-overlay")?.remove();
    document.getElementById("wt-annotation-layer")?.remove();
    
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
  }


  // ============================================================
  // RENDERING ANNOTATIONS
  // ============================================================

  /**
   * Main render loop for all annotations
   * Syncs viewport, clears previous render, renders all frames
   */
  async function renderAnnotations() {
    const id = ++_renderCount;
      
    const _container = archiveProvider.getViewerContainer();
    if (!_container) return;

    // Clear previous render
    while (_annotationLayer.firstChild) {
      _annotationLayer.removeChild(_annotationLayer.firstChild);
    }

    if (!isVisible()) return;

    // Load annotations for current page if not yet loaded
    await annotationsAPI.loadAnnotationsIfNeeded();

    // Render each annotation's frames
    const annotations = annotationsAPI.getAnnotations();

    const promises = [];

    for (const a of annotations) {
      for (const [index, frameData] of a.frames.entries()) {
        promises.push(_renderFrame(a, frameData, index, id));
      }
    }

    await Promise.all(promises);

    if (id !== _renderCount) {
      console.log("Render interrupted by newer render request, aborting");
      return;
    }

    updateSelectionStyles();
    ui.updateToolUI();
  
    // Reset incoming WT ID after first render to avoid highlighting a new frame later
    incomingWtId = null;
  }


  /**
   * Renders a single annotation frame on screen
   * Converts image space coordinates to screen pixels
   * @param {Object} a - Annotation object
   * @param {Object} frameData - Frame coordinates {x, y, w, h} in image space
   * @param {number} index - Frame index within annotation
   */
  async function _renderFrame(a, frameData, index, renderId) {
    // 1. Create an SVG polygon
    const frame = document.createElementNS(svgNS, "polygon");
    frame.setAttribute("class", "wt-annotation");

    const imageFrameCorners = [          
          {x: frameData.x, y: frameData.y},  // top-left
          {x: frameData.x + frameData.w, y: frameData.y},  // top-right
          {x: frameData.x + frameData.w, y: frameData.y + frameData.h},  // bottom-right
          {x: frameData.x, y: frameData.y + frameData.h}  // bottom-left
    ];

    // 2. Project all 4 true corner coordinates
    const screenFrameCorners = await archiveProvider.projectImagePoints(imageFrameCorners);
  
    // 3. Map corners straight into the SVG 'points' attribute
    const pointsString = screenFrameCorners.map(p => `${p.x},${p.y}`).join(" ");
    frame.setAttribute("points", pointsString);

    // 4. Set tooltip 
    let tooltipText = personAPI.formatDisplayName(a.wikitreeid);
    if (frameData.note) {
      tooltipText += "\n" + frameData.note;
    }
    const titleEl = document.createElementNS(svgNS, "title");
    titleEl.textContent = tooltipText;
    frame.appendChild(titleEl);
    
    // Highlight if this annotation matches incoming profile
    if (a.wikitreeid === incomingWtId) {
      _triggerRefHighlight(a.wikitreeid);
      incomingWtId = null;
    }

    // Track annotation ID (WT ID) and frame index for toolbar/resize operations
    frame.dataset.annotationId = a.wikitreeid;
    frame.dataset.frameIndex = index;

    // Click handler: select in select mode, or open WikiTree profile
    frame.addEventListener("click", (e) => {
      if (tools.isSelecting()) {
        const id = frame.dataset.annotationId;
        // if there isn't currently a selected annotation, or if current and new are the same
        if (!tools.getSelectedAnnotationId() || tools.getSelectedAnnotationId() === id) {
          e.stopPropagation();
          const frameIndex = Number(frame.dataset.frameIndex);
          tools.selectAnnotation(id, frameIndex);
        }
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
        .querySelectorAll(`[data-annotation-id="${id}"]`)
        .forEach(el => {
          el.classList.add("wt-hover");
        });
    });

    frame.addEventListener("mouseleave", () => {
      if (tools.isDrawing() || tools.isSelecting()) return;

      const id = frame.dataset.annotationId;
      document
        .querySelectorAll(`[data-annotation-id="${id}"]`)
        .forEach(el => {
          el.classList.remove("wt-hover");
        });
    });

    if (!a.wtIdFound) {
      _addInvalidBadge(screenFrameCorners);
    } 

    // Check to make sure this render is still the latest one; if not, abort to avoid stacked frames
    if (renderId !== _renderCount) {
      return;
    }

    _annotationLayer.appendChild(frame);
  }


  function _addInvalidBadge(cornerPoints) {
    const badge = document.createElementNS(svgNS, "text");
    badge.textContent = "⛓️‍💥";

    // Identify the top-right corner point from the 4-point array
    // Assuming corners are: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
    const topRight = cornerPoints[1]; 

    // Position the text anchor near the top-right corner point
    // Adjust dx/dy offsets if needed so the emoji doesn't bleed outside the box
    const offsetX = -18; 
    const offsetY = 16;

    badge.setAttribute("x", topRight.x + offsetX);
    badge.setAttribute("y", topRight.y + offsetY);
  
    Object.assign(badge.style, {
      fontSize: "18px",
      pointerEvents: "none",
      zIndex: "2"
    });

    // Append it to the main SVG layer alongside the polygon, not inside it
    _annotationLayer.appendChild(badge);
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
    ignoreNextClick, 
    createLayers,
    attachEvents,
    setVisible,
    isVisible,
    renderAnnotations,
    setDrawingState,
    updateSelectionStyles
  };

})();

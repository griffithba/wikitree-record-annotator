(() => {
  "use strict";

  let _attachedViewer = null;

  let lastVp = "";

  function _projectImagePoints(viewer, points) {
    const item = viewer.world.getItemAt(0);
    const screenPoints = [];

    for (const { x, y } of points) {
      const vp = item.imageToViewportCoordinates(x, y, true);
      const screenPoint = viewer.viewport.pixelFromPoint(vp, true);
      screenPoints.push({
        x: screenPoint.x,
        y: screenPoint.y
      });
    }

    return screenPoints;
  }


  function _unprojectScreenPoints(viewer, points) {
    const item = viewer.world.getItemAt(0);
    const imagePoints = [];

    const vp0 = item.imageToViewportCoordinates(0, 0, true);

    for (const { x, y } of points) {
      const pixel = vp0.clone();
      pixel.x = x;
      pixel.y = y;

      const vp = viewer.viewport.pointFromPixel(pixel, true);
      const image = item.viewportToImageCoordinates(vp, true);

      imagePoints.push({
        x: image.x,
        y: image.y
      });
    }

    return imagePoints;
  }


  function _debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }


  function _attach(viewer) {
    if (viewer === _attachedViewer) return;
    _attachedViewer = viewer;

    const debouncedSend = _debounce(() => _sendViewport(viewer), 10);

    //viewer.addHandler("animation", debouncedSend);
    viewer.addHandler("animation", () => _sendViewport(viewer));

    viewer.addHandler("open", () => _sendViewport(viewer));

    // Initial state
    _sendViewport(viewer);
  }


  function _sendViewport(viewer) {
    if (!viewer) return;
    const bounds = viewer.viewport.getBounds(true);

    // Keep the full viewport precision. Earlier versions quantized these
    // values to reduce render frequency, but render cancellation now prevents
    // overlapping renders, so quantization is unnecessary and can cause visible
    // lagging and jumping on viewers with different coordinate scales.
    const vp = {
        x: (bounds.x),
        y: (bounds.y),
        w: (bounds.width),
        h: (bounds.height),
        rotation: ((viewer.viewport.getRotation(true) % 360) + 360) % 360
    };

    const key = JSON.stringify(vp);
    if (key === lastVp) return;
    lastVp = key;

    window.postMessage({
        type: "OPENSEADRAGON_VIEW_CHANGED",
        viewport: vp
    });
  }


  function initialize(getViewer) {
    const viewer = getViewer();
    if (!viewer) return;
    _attach(viewer);

    window.addEventListener("message", event => {
      if (event.source !== window) return;

      if (event.data?.type === "WT_PROJECT_IMAGE_POINTS") {
        const points = _projectImagePoints(
          viewer,
          event.data.points
        );

        window.postMessage({
          type: "WT_PROJECT_IMAGE_POINTS_RESULT",
          requestId: event.data.requestId,
          points
        });
      }

      if (event.data?.type === "WT_UNPROJECT_SCREEN_POINTS") {
        const viewer = getViewer();
      
        const imagePoints = _unprojectScreenPoints(
          viewer, 
          event.data.points
        );

        window.postMessage({
          type: "WT_UNPROJECT_SCREEN_POINTS_RESULT",
          points: imagePoints
        });
      }
   });
  }

  window.openseadragonPage = {
    initialize
  };

})();


(() => {
  "use strict";

  let _uvExtension = null;
  let _viewer = null;

  let attachedViewer = null;

  let lastVp = "";


  function getUvExtension() {
    if (_uvExtension) return _uvExtension;

    const host = document.querySelector(".uv-iiif-extension-host");
    if (!host) return null;

    const key = Object.getOwnPropertyNames(host)
        .find(k => k.startsWith("jQuery"));
    if (!key) return null;

    _uvExtension = host[key].component.extension;
    return _uvExtension;
  }

  function getViewer() {
    if (_viewer) return _viewer;

    const extension = getUvExtension();
    if (!extension) return null;

    _viewer = extension.centerPanel.viewer;
    return _viewer;
  }


  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }


  function attach(viewer) {
    if (viewer === attachedViewer) return;
    attachedViewer = viewer;

    const debouncedSend = debounce(sendViewport, 10);

    viewer.addHandler("animation", debouncedSend);
    //viewer.addHandler("resize", debouncedSend);

    //viewer.addHandler("rotate", sendViewport);
    viewer.addHandler("open", sendViewport);

    // Initial state
    sendViewport();
  }


  function quantize(v) {
    return Math.round(v * 4) / 4;   // nearest quarter image pixel
  }


  function sendViewport() {
    const viewer = getViewer();
    if (!viewer) return;
    const bounds = viewer.viewport.getBounds(true);

    const vp = {
        x: quantize(bounds.x),
        y: quantize(bounds.y),
        w: quantize(bounds.width),
        h: quantize(bounds.height),
        rotation: ((viewer.viewport.getRotation(true) % 360) + 360) % 360
    };

    const key = JSON.stringify(vp);
    if (key === lastVp) return;
    lastVp = key;

    window.postMessage({
        type: "RIKSARKIVET_VIEW_CHANGED",
        viewport: vp
    });
  }

  attach(getViewer());


  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type === "WT_PROJECT_IMAGE_POINTS") {
      const extension = getUvExtension();
      const viewer = getViewer();
      const item = viewer.world.getItemAt(0);

      const { points, requestId } = event.data;
      const screenPoints = [];

      for (const { x, y } of points) {
        const vp = item.imageToViewportCoordinates(x, y, true);
        const screenPoint = viewer.viewport.pixelFromPoint(vp, true);
        screenPoints.push({x: screenPoint.x, y: screenPoint.y});
      }

      window.postMessage({
        type: "WT_PROJECT_IMAGE_POINTS_RESULT",
        requestId,
        points: screenPoints
      });
    }

    if (event.data?.type === "WT_UNPROJECT_SCREEN_POINTS") {
      const extension = getUvExtension();
      const viewer = getViewer();
      const item = viewer.world.getItemAt(0);

      const { points } = event.data;

      const imagePoints = [];

      const vp0 = item.imageToViewportCoordinates(0, 0, true);

      for (const {x, y} of points) {
        const pixel = vp0.clone();
        pixel.x = x;
        pixel.y = y;
        const vp = viewer.viewport.pointFromPixel(pixel, true);
        const image = item.viewportToImageCoordinates(vp, true);
        imagePoints.push({x: image.x, y: image.y});
      }

      window.postMessage({
        type: "WT_UNPROJECT_SCREEN_POINTS_RESULT",
        points: imagePoints
      });
    }
  });

})();

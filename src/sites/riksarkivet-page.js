(() => {
  "use strict";

  let _uvExtension = null;


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


  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type === "WT_GET_ROTATION") {
      const extension = getUvExtension();
      const deg = ((extension.getViewerRotation() % 360) + 360) % 360;
      const rotation = deg * Math.PI / 180;

      window.postMessage({
        type: "WT_ROTATION",
        rotation
      });
    }

    if (event.data?.type === "WT_PROJECT_IMAGE_POINTS") {
      const extension = getUvExtension();
      const viewer = extension.centerPanel.viewer;
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
      const viewer = extension.centerPanel.viewer;
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


  window.postMessage({
    type: "WT_RIKSARKIVET_READY"
  });
})();

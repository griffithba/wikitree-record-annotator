(() => {
  "use strict";


  // get the OpenSeadragon container (the element the overlay should attach to)
  function getViewerContainer() {
    return document.querySelector(".openseadragon-canvas");
  }


  async function projectImagePoints(imagePoints) {
    const requestId = crypto.randomUUID();

    return new Promise((resolve) => {

      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.type !== "WT_PROJECT_IMAGE_POINTS_RESULT") return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener("message", onMessage);
        resolve(event.data.points);
      }

      window.addEventListener("message", onMessage);

      window.postMessage({
        type: "WT_PROJECT_IMAGE_POINTS",
        requestId,
        points: imagePoints
      });
    });
  }


  async function unprojectScreenPoints(screenPoints) {
    return new Promise((resolve) => {
      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.type !== "WT_UNPROJECT_SCREEN_POINTS_RESULT") return;

        window.removeEventListener("message", onMessage);
        resolve(event.data.points);
      }

      window.addEventListener("message", onMessage);

      window.postMessage({
        type: "WT_UNPROJECT_SCREEN_POINTS",
        points: screenPoints
      });
    })
  }


  // Tracks viewport changes (pan/zoom/rotate) and re-renders annotations to maintain alignment
  function initializeViewportTracking() {
    window.addEventListener("message", e => {
      if (e.source !== window) return;

      if (e.data?.type === "OPENSEADRAGON_VIEW_CHANGED") {
        overlay.renderAnnotations();
      }
    });
  }


  window.openseadragon = {
    getViewerContainer,
    projectImagePoints,
    unprojectScreenPoints,
    initializeViewportTracking
  };

})();
// digitalarkivet-page.js
(() => {
  "use strict";

  let _viewer = null;

  function getViewer() {
    if (_viewer) return _viewer;

    // Digitalarkivet-specific viewer discovery goes here.

    return _viewer;
  }

  openseadragonPage.initialize(getViewer);
})();
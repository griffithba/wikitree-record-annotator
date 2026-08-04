(() => {
  "use strict";

  const openseadragonPage = window.openseadragonPage;

  let _uvExtension = null;
  let _viewer = null;


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


  // Give the shared OpenSeadragon page-side code a Riksalarkivet-specific
  // way to find the viewer. Everything after this point—viewport tracking,
  // image/screen coordinate conversion, etc.—is handled by openseadragon-page.js.
  openseadragonPage.initialize(getViewer);

})();

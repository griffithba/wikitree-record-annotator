(() => {
  "use strict";

  let _viewer = null;
  let _openSeadragon = null;
  let _webpackRequire = null;


  /**
   * Gets Webpack's internal require function.
   *
   * Digitalarkivet's new viewer uses OpenSeadragon, but it does not expose
   * OpenSeadragon as window.OpenSeadragon. Instead, it is bundled into the
   * site's Webpack application.
   *
   * Webpack exposes its chunk array as window.webpackChunk_N_E. By pushing
   * a small, artificial chunk onto that array, Webpack invokes the callback
   * with its internal require function. We save that function so we can
   * load the OSD module once we have identified it.
   */
  function _getWebpackRequire() {
    if (_webpackRequire) return _webpackRequire;

    window.webpackChunk_N_E.push([
      [Symbol()],
      {},
      function (require) {
        _webpackRequire = require;
      }
    ]);

    return _webpackRequire;
  }


  /**
   * Finds Digitalarkivet's OpenSeadragon module.
   *
   * The OSD module is not exposed as a normal global. It is one of the
   * modules contained in the site's Webpack chunks.
   *
   * We deliberately do NOT hard-code the module ID (currently 115208).
   * Webpack module IDs can change when Digitalarkivet rebuilds the site.
   *
   * Instead, search the module factories for strings that are distinctive
   * to the OpenSeadragon module. We found during reverse engineering that
   * this module contains both:
   *
   *     versionStr
   *     getViewer
   *
   * The search currently identifies module 115208, but the important thing
   * is that the ID is discovered dynamically.
   *
   * Returns the OpenSeadragon namespace, or null if it cannot be found.
   */
  function _findOpenSeadragon() {
    if (_openSeadragon) return _openSeadragon;

    const webpack = window.webpackChunk_N_E;
    if (!webpack) return null;

    const match = webpack
      .flatMap(chunk => Object.entries(chunk[1] || {}))
      .find(([id, factory]) =>
        typeof factory === "function" &&
        factory.toString().includes("versionStr") &&
        factory.toString().includes("getViewer")
      );

    if (!match) return null;

    const moduleId = match[0];
    const webpackRequire = _getWebpackRequire();

    if (!webpackRequire) return null;

    // Load the module through Webpack rather than executing its factory
    // ourselves. This gives us the module's actual exported object.
    _openSeadragon = webpackRequire(moduleId);

    return _openSeadragon;
  }


  /**
   * Finds Digitalarkivet's actual OpenSeadragon Viewer instance.
   *
   * The viewer is created by Digitalarkivet with the DOM element ID
   * "openSeaDragon". The OpenSeadragon module provides getViewer(), which
   * lets us retrieve the Viewer instance associated with that element.
   *
   * Returns the Viewer instance, or null if it is not available yet.
   */
  function getViewer() {
    if (_viewer) return _viewer;

    const osd = _findOpenSeadragon();
    if (!osd) return null;

    _viewer = osd.getViewer("openSeaDragon");

    return _viewer;
  }


  // Give the shared OpenSeadragon page-side code a Digitalarkivet-specific
  // way to find the viewer. Everything after this point—viewport tracking,
  // image/screen coordinate conversion, etc.—is handled by openseadragon-page.js.
  openseadragonPage.initialize(getViewer);

})();

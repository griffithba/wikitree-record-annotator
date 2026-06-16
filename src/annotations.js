
(() => {
  "use strict";

  // Annotations array (stored in IMAGE SPACE coordinates)
  let _annotations = [];
  // Page tracking for lazy loading
  let _lastPageKey = null;               // Track current page to avoid redundant loads



  // ============================================================
  // STORAGE & PERSISTENCE
  // ============================================================

  /**
   * Saves annotations for current page to storage
   * Preserves annotations for other pages
   */ /*
  async function saveAnnotationsForPage() {
    const key = archiveProvider.getCurrentPageKey();

    const all = await storageAPI.getAnnotations();

    // Remove old annotations for this page
    const others = all.filter(a => a.page !== key);

    // Add updated ones
    const updated = [...others, ..._annotations];

    // WARNING: Using this function incorrectly will delete all annotations!
    await storageAPI.saveAnnotations(updated);
  } */

  /**
   * Gets all annotations for a this page
   * @returns {Array} Annotations for current page
   */
  async function _getAnnotationsForCurrentPage() {
    return(await wtplusAPI.getFramesForPage()) || [];
  }

  function getAnnotations() {
    return _annotations;
  }



  /**
   * Loads annotations for current page if not already loaded
   */
  async function loadAnnotationsIfNeeded() {
    const key = archiveProvider.getCurrentPageKey();

    if (samePage(key, _lastPageKey)) return;  // Already loaded
    _lastPageKey = key;

    _annotations = await _getAnnotationsForCurrentPage() || [];

    console.log(`Loaded ${_annotations.length} annotations for page ${key}`, 
                _annotations);
    // pre-fetch person data for all annotations simultaneously
    await Promise.all(
      _annotations.map(async a => {
          a.wtIdFound = await personAPI.prefetch(a.wikitreeid); 
      })
    );

    function samePage(a, b) {
      return a &&
             b &&
             a.site === b.site &&
             a.book === b.book &&
             a.page === b.page;
    }
  }


  // ============================================================
  // ANNOTATION OPERATIONS (ADD/DELETE)
  // ============================================================

  /**
   * Deletes a specific frame from an annotation
   * If last frame, deletes entire annotation
   * @param {string} wtId - WikiTree ID
   * @param {number} frameIndex - Index of frame to delete
   */
  async function deleteFrame(wtId, frameIndex) {
    const annotation = getAnnotationByWtId(wtId);
    if (!annotation) return;

    // Delete frame from WT+ backend
    wtplusAPI.deleteFrame(wtId, frameIndex);

    // Then delete from local state and re-render
    if (annotation.frames.length > 1) {
      // Remove just this frame
      annotation.frames.splice(frameIndex, 1);
    } else {
      // Last frame → delete entire annotation
      _deleteAnnotation(wtId);
      //return;
    }

    overlay.renderAnnotations();
  }


  async function addFrame(wtId, frame) {

    // Add frame to WT+ backend
    const newFrameId = await wtplusAPI.addFrame(wtId, frame);

    if (!newFrameId) return;

    frame.frameid = newFrameId;

    let annotation = getAnnotationByWtId(wtId);

    if (!annotation) {
      annotation = {
        frames: [frame],
        wikitreeid: wtId,
        wtIdFound: await personAPI.prefetch(wtId) // pre-fetch person data for this ID
      }
      _annotations.push(annotation);
    } else {
      annotation.frames.push(frame);
    }

    overlay.renderAnnotations();
  }


  /**
   * Deletes entire annotation and clears selection (local only, not WT+ backend)
   * @param {string} id - Annotation/WikiTree ID
   */
  async function _deleteAnnotation(id) {
    _annotations = _annotations.filter(a => a.wikitreeid !== id);
    //await saveAnnotationsForPage();
    if (tools.getSelectedAnnotationId() === id) tools.clearSelection();
    //overlay.renderAnnotations();
  }

  /**
   * Finds annotation by WikiTree ID
   * @param {string} wtId - WikiTree ID
   * @returns {Object|null} Annotation object or null if not found
   */
  function getAnnotationByWtId(wtId) {
    const a = _annotations.find(x => x.wikitreeid === wtId);
    if (!a) console.log("Annotation not found:", wtId);
    return a || null;
  }

  function invalidateAnnotationCache() {
    _lastPageKey = null;
  }

  window.annotationsAPI = {
    addFrame,
    getAnnotationByWtId,
    getAnnotations,
    loadAnnotationsIfNeeded,
    deleteFrame,
    invalidateAnnotationCache
  };


})();

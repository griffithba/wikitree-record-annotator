
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
   */
  async function saveAnnotationsForPage() {
    const key = archiveProvider.getCurrentPageKey();

    const all = await storageAPI.getAnnotations();

    // Remove old annotations for this page
    const others = all.filter(a => a.page !== key);

    // Add updated ones
    const updated = [...others, ..._annotations];

    // WARNING: Using this function incorrectly will delete all annotations!
    await storageAPI.saveAnnotations(updated);
  }

  async function updateExistingAnnotation(id, patch) {
    await storageAPI.updateAnnotation(id, patch);
  }

  /**
   * Gets all annotations for a specific page
   * @param {string} pageKey - Page identifier
   * @returns {Array} Annotations for that page
   */
  async function _getAnnotationsByPage(site, book, page) {
    return(await wtplusAPI.getFramesForPage(site, book, page)) || [];
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

    _annotations = await _getAnnotationsByPage(key.site, key.book, key.page) || [];

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
   * Deletes a specific box from an annotation
   * If last box, deletes entire annotation
   * @param {string} annotationId - Annotation ID
   * @param {number} boxIndex - Index of box to delete
   */
  async function deleteBox(annotationId, boxIndex) {
    const annotation = getAnnotationByWtId(annotationId);
    if (!annotation) return;

    if (annotation.boxes.length > 1) {
      // Remove just this box
      annotation.boxes.splice(boxIndex, 1);
    } else {
      // Last box → delete entire annotation
      _deleteAnnotation(annotationId);
      return;
    }

    await saveAnnotationsForPage();
    overlay.renderAnnotations();
  }

  async function addAnnotation(annotation) {
    _annotations.push(annotation);
    // await saveAnnotationsForPage();
    overlay.renderAnnotations();
  }

  /**
   * Deletes entire annotation and clears selection
   * @param {string} id - Annotation ID
   */
  async function _deleteAnnotation(id) {
    _annotations = _annotations.filter(a => a.id !== id);
    await saveAnnotationsForPage();
    if (tools.getSelectedAnnotationId() === id) tools.clearSelection();
    overlay.renderAnnotations();
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
    addAnnotation,
    saveAnnotationsForPage,
    updateExistingAnnotation,
    getAnnotationByWtId,
    getAnnotations,
    loadAnnotationsIfNeeded,
    deleteBox,
    invalidateAnnotationCache
  };


})();

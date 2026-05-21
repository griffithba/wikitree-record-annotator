
(() => {
  "use strict";

  // Annotations array (stored in IMAGE SPACE coordinates)
  let annotations = [];
  // Page tracking for lazy loading
  let lastPageKey = null;               // Track current page to avoid redundant loads



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
    const updated = [...others, ...annotations];

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
  async function getAnnotationsByPage(pageKey) {
    const all = await storageAPI.getAnnotations();
    return all.filter(a => a.page === pageKey);
    console.log("Loaded annotations for page", pageKey, annotations);
  }

  function getAnnotations() {
    return annotations;
  }

  /**
   * Loads annotations for current page if not already loaded
   * Lazy loads to avoid loading every page's annotations at startup
   */
  async function loadAnnotationsIfNeeded() {
    const key = archiveProvider.getCurrentPageKey();

    if (key === lastPageKey) return;  // Already loaded
    lastPageKey = key;

    // only store annotations specific to this page
    annotations = await getAnnotationsByPage(key);

    let saveNeeded = false;
    // loop through annotations cleaning up from old format
    annotations.forEach(a => {
      if (a.name) {delete a.name; saveNeeded = true;}
      if (a.birth) {delete a.birth; saveNeeded = true;}
      if (a.death) {delete a.death; saveNeeded = true;}
      if (a.status) {delete a.status; saveNeeded = true;}
    });
    
    // pre-fetch person data for all annotations simultaneously
    const tasks = annotations.map(async a => {
      a.wtIdFound = await personAPI.prefetch(a.wtId); 
    });

    if (saveNeeded) tasks.push(saveAnnotationsForPage(annotations));

    await Promise.all(tasks);
  }


  // ============================================================
  // SECTION 11: ANNOTATION OPERATIONS (ADD/DELETE)
  // ============================================================

  /**
   * Deletes a specific box from an annotation
   * If last box, deletes entire annotation
   * @param {string} annotationId - Annotation ID
   * @param {number} boxIndex - Index of box to delete
   */
  async function deleteBox(annotationId, boxIndex) {
    const annotation = getAnnotationById(annotationId);
    if (!annotation) return;

    if (annotation.boxes.length > 1) {
      // Remove just this box
      annotation.boxes.splice(boxIndex, 1);
    } else {
      // Last box → delete entire annotation
      deleteAnnotation(annotationId);
      return;
    }

    await saveAnnotationsForPage(annotations);
    overlay.renderAnnotations();
  }

  async function addAnnotation(annotation) {
    annotations.push(annotation);
    await saveAnnotationsForPage(annotations);
    overlay.renderAnnotations();
  }

  /**
   * Deletes entire annotation and clears selection
   * @param {string} id - Annotation ID
   */
  async function deleteAnnotation(id) {
    annotations = annotations.filter(a => a.id !== id);
    await saveAnnotationsForPage(annotations);
    if (tools.getSelectedAnnotationId() === id) tools.clearSelection();
    overlay.renderAnnotations();
  }

  /**
   * Finds annotation by ID
   * @param {string} id - Annotation ID
   * @returns {Object|null} Annotation object or null if not found
   */
  function getAnnotationById(id) {
    const a = annotations.find(x => x.id === id);
    if (!a) console.warn("Annotation not found:", id);
    return a || null;
  }

  window.annotationsAPI = {
    addAnnotation,
    saveAnnotationsForPage,
    updateExistingAnnotation,
    getAnnotationById,
    getAnnotations,
    loadAnnotationsIfNeeded,
    deleteBox,
    deleteAnnotation
  };


})();
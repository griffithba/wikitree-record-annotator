
(() => {
  "use strict";

  // Annotations array (stored in IMAGE SPACE coordinates)
  let _annotations = [];
  // Page tracking for lazy loading
  let _lastPageKey = null;               // Track current page to avoid redundant loads


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

    console.log(`Loaded ${_annotations.length} annotations for page ${key.book} ${key.page}`, 
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
  // ANNOTATION OPERATIONS (ADD/DELETE/EDIT)
  // ============================================================


  async function addFrame(wtId, frame) {

    let annotation = getAnnotationByWtId(wtId);
    let frameIndex = 0;

    if (!annotation) {
      annotation = {
        frames: [frame],
        wikitreeid: wtId,
        wtIdFound: await personAPI.prefetch(wtId), // pre-fetch person data for this ID
        _new: true
      }
      _annotations.push(annotation);
    } else {
      ensureUndoSnapshot(wtId);
      frameIndex = annotation.frames.push(frame) - 1;
    }

    overlay.renderAnnotations();

    return frameIndex;
  }


  /**
   * Deletes a specific frame from an annotation (deletes from WT+)
   * If last frame, deletes entire annotation
   * @param {string} wtId - WikiTree ID
   * @param {number} frameIndex - Index of frame to delete
   */
  async function deleteFrame(wtId, frameIndex) {
    const annotation = getAnnotationByWtId(wtId);
    if (!annotation) return;

    const frameId = annotation.frames[frameIndex].frameid;

    // Only delete it from WT+ if it's actually there. 
    if (frameId) {
      // Delete frame from WT+ backend
      const success = await wtplusAPI.deleteFrame(wtId, frameId);

      if (!success) {
        console.warn("Failed to delete frame:", wtId, frameId);
        return;
      }
    }

    // Then delete from local state and re-render
    if (annotation.frames.length > 1) {
      // Remove just this frame
      annotation.frames.splice(frameIndex, 1);
    } else {
      // Last frame → delete entire annotation
      _annotations = _annotations.filter(a => a.wikitreeid !== wtId);
      if (tools.getSelectedAnnotationId() === wtId) tools.clearSelection();
    }

    overlay.renderAnnotations();
  }
  

  function markForDeletion(wtId, frameIndex) {
    const annotation = getAnnotationByWtId(wtId);
    if (!annotation) return;
    ensureUndoSnapshot(wtId);
    annotation.frames[frameIndex]._delete = true;
  }

  
  function unmarkForDeletion(wtId, frameIndex) {
    const annotation = getAnnotationByWtId(wtId);
    if (!annotation) return;
    delete annotation.frames[frameIndex]._delete;
  }

  
  async function updateAnnotation(wtId) {
    const a = getAnnotationByWtId(wtId);
    if (!a) return; 
    if (a?._new) delete a._new;
    const promises = [];
    // loop through all frames in the annotation
    for (const [index, frame] of a.frames.entries()) {
      if (frame._delete) {
        await deleteFrame(wtId, index);
        return; // equivalent to "continue"
      }
      // if changes were made
      if (frame._dirty) {
        const oldFrameId = frame.frameid;
        // save a new copy of the frame
        const newFrameId = await wtplusAPI.addFrame(wtId, frame);
        if (newFrameId) {
          // store the new frame ID
          frame.frameid = newFrameId;
          // if there was an old frame ID (this isn't a new frame)
          if (oldFrameId) {
            // delete the old version
            const success = await wtplusAPI.deleteFrame(wtId, oldFrameId);
            console.log("Updated existing frame for", wtId, "frame:", frame);
          }
          else console.log("Added new frame for", wtId, "frame:", frame);
        }
        delete frame._dirty;
      }
    }
  }


  function ensureUndoSnapshot(wtId) {
    const a = getAnnotationByWtId(wtId);
    if (!a) { console.log("No annotation");return; }
    if (a._new) { console.log("Already marked as new"); return; }
    if (a.originalFrames) {console.log("Undo snapshot already saved"); return; }
console.log("Creating undo snapshot");
    a.originalFrames = structuredClone(a.frames);
  }


  function cancelAnnotationChanges(wtId) {
    const annotation = getAnnotationByWtId(wtId);
    if (annotation._new) _deleteAnnotation(annotation);
    else if (annotation.originalFrames) {
      annotation.frames = structuredClone(annotation.originalFrames);
      delete annotation.originalFrames;
    } 
  }

  
  function _deleteAnnotation(annotation) {
    const index = _annotations.indexOf(annotation);
    if (index >= 0) {
      _annotations.splice(index, 1);
    }
  }


  /**
   * Finds annotation by WikiTree ID
   * @param {string} wtId - WikiTree ID
   * @returns {Object|null} Annotation object or null if not found
   */
  function getAnnotationByWtId(wtId) {
    const a = _annotations.find(x => x.wikitreeid === wtId);
    return a || null;
  }

  
  window.annotationsAPI = {
    addFrame,
    deleteFrame,
    markForDeletion,
    unmarkForDeletion,
    ensureUndoSnapshot,
    cancelAnnotationChanges,
    updateAnnotation,
    getAnnotationByWtId,
    getAnnotations,
    loadAnnotationsIfNeeded
  };


})();

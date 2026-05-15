(() => {

  let currentTool = null;               // Active tool: null | "draw" | "select"
  
  function getTool() {
    return currentTool;
  }

  function isDrawing() {
    return currentTool === "draw";
  }

  function isSelecting() {
    return currentTool === "select";
  }

  /**
   * Switch between tools (draw/select) with toggle behavior
   * When switching away from "select", clears selection
   * @param {string} nextTool - Tool to switch to: "draw" | "select"
   */
  function setTool(nextTool) {
    const prevTool = currentTool;
  
    // Toggle behavior: clicking same tool twice turns it off
    currentTool = (currentTool === nextTool) ? null : nextTool;

    // Clean up when leaving select mode
    if (prevTool === "select" && currentTool !== "select") {
      clearSelection();
      closeWtEditor();
    }

    // Update overlay interaction
    overlay.style.pointerEvents = isDrawing() ? "auto" : "none";
    overlay.style.cursor = isDrawing() ? "crosshair" : "default";

    // Auto-show annotations when entering draw mode
    if (!showAnnotations && isDrawing()) {
      showAnnotations = true;
      renderAnnotations();
    }

    // Visual feedback: tint overlay only in draw mode
    overlay.style.background = isDrawing() ? "var(--wt-draw-overlay-bg)" : "transparent";
    overlay.style.border = isDrawing() ? "var(--wt-draw-overlay-border)" : "none";
  }

  window.tools = {
    setTool,
    getTool,
    isDrawing,
    isSelecting
  }
})();
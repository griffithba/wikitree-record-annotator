// ============================================================
// STYLES & CSS INJECTION
// ============================================================
(() => {
  "use strict";
  
  function injectStyles() {
    if (document.getElementById("wt-styles")) return;

    const style = document.createElement("style");
    style.id = "wt-styles";

    style.textContent = `
      :root {
        --wt-draw-overlay-bg: rgba(255, 0, 0, 0.1);
        --wt-draw-bg: rgba(25, 0, 255, 0.1);
        --wt-draw-stroke: red;
        --wt-draw-stroke-width: 2px;
        --wt-draw-stroke-dash: 6, 4;
        --wt-toolbar-bg: rgba(255, 171, 15, 0.85);
      }

      #wt-annotation-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 99998;
        pointer-events: none;
      }

      #wt-overlay {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 99999;
        cursor: default;
        pointer-events: none;
      }

      /* Style rule for temporary drawing box primitive */
      .wt-drawing-feedback {
        fill: var(--wt-draw-bg);
        stroke: var(--wt-draw-stroke);
        stroke-width: var(--wt-draw-stroke-width);
        stroke-dasharray: var(--wt-draw-stroke-dash);
      }

      .wt-annotation {
        /* SVG Properties */
        stroke: lime;
        stroke-width: 2px;
        fill: rgba(0, 255, 0, 0.1);
  
        /* Crucial for SVG Mouse Events */
        pointer-events: visiblePainted; 
        cursor: pointer;
  
        /* Smooth outline transition */
        transition: stroke-width 0.05s ease, stroke 0.05s ease;
      }

      .wt-annotation.wt-hover {
        stroke: lime;
        stroke-width: 4px;
        cursor: pointer !important;
      }

      .wt-annotation.wt-selected {
        stroke: orange;
        stroke-width: 3px;
        fill: rgba(255, 165, 0, 0.15);
      }

      .wt-annotation.wt-selected.wt-unsaved-changes {
        stroke-dasharray: 8 4;
      }

      .wt-annotation.wt-selected.wt-pending-delete {
        stroke-dasharray: 8 4;
        stroke-opacity: 0.3;
        fill-opacity: 0.05;
      }

      .wt-ref-highlight {
        animation: wtPulse 1.5s ease-out 5;
      }

      @keyframes wtPulse {
        0% { 
          /* Start with a noticeable orange border */
          stroke: rgba(255, 171, 15, 0.85); 
          stroke-width: 2px; 
        }
        100% { 
          /* Expand the line outward and fade it completely out */
          stroke: rgba(0, 255, 255, 0); 
          stroke-width: 14px; 
        }
      }
  
      .annotation {
        position: absolute;
      }

      foreignObject .annotation-toolbar {
        position: relative;
        top: 0;
        right: 0;
        width: max-content;
        height: max-content;

        background: rgb(38, 35, 32);
        padding: 4px 6px;
        border-radius: 6px;

        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
      }

      .annotation-toolbar button {
        background: transparent;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
      }

      .resize-handle {
        fill: white;
        stroke: black;
        stroke-width: 2px;
        pointer-events: visiblePainted;
      }

      .resize-handle.nw { cursor: nwse-resize; }
      .resize-handle.ne { cursor: nesw-resize; }
      .resize-handle.sw { cursor: nesw-resize; }
      .resize-handle.se { cursor: nwse-resize; }

      .rotate-handle {
        pointer-events: visiblePainted;
        cursor: grab;
      }
    `;
    document.head.appendChild(style);
  }

  window.theme = {injectStyles};

})();

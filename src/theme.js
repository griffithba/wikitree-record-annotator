// ============================================================
// STYLES & CSS INJECTION
// ============================================================
(() => {
  function injectStyles() {
    if (document.getElementById("wt-styles")) return;

    const style = document.createElement("style");
    style.id = "wt-styles";

    style.textContent = `
      :root {
        --wt-draw-overlay-bg: rgba(255,0,0,0.1);
        --wt-draw-overlay-border: 2px solid red;
        --wt-draw-bg: rgba(25, 0, 255, 0.1);
        --wt-draw-border: 2px dashed red;
        --wt-toolbar-bg: rgba(255, 171, 15, 0.85);
      }
  
      .wt-annotation {
        border: 2px solid lime;
        background: rgba(0,255,0,0.1);
        position: absolute;
        pointer-events: auto;
        transition: border 0.05s ease;
      }

      .wt-annotation.wt-hover {
        border: 4px solid lime;
        background: rgba(0,255,0,0.1);
        position: absolute;
        pointer-events: auto;
        transition: border 0.05s ease;
      }

      .wt-annotation.wt-selected {
        border: 3px solid orange;
        background: rgba(255,165,0,0.15);
      }
      
      .wt-ref-highlight {
        animation: wtPulse 1.5s ease-out 5;
      }

      @keyframes wtPulse {
        0%   { box-shadow: 0 0 0 0 rgba(255, 171, 15, 0.85); }
        100% { box-shadow: 0 0 0 12px rgba(0,255,255,0); }
      }

      .annotation {
        position: absolute;
      }

      .annotation-toolbar {
        position: absolute;
        top: -40px;
        right: 0;

        display: flex;
        gap: 4px;

        background: rgba(38, 35, 32, 0.8);
        padding: 4px 6px;
        border-radius: 6px;

        z-index: 10;

        pointer-events: auto;
      }

      .annotation-toolbar button {
        background: transparent;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
      }

      .resize-handle {
        position: absolute;
        width: 10px;
        height: 10px;
        background: white;
        border: 2px solid black;
        border-radius: 50%;
        z-index: 20;
      }

      .resize-handle.nw { top: -6px; left: -6px; cursor: nwse-resize; }
      .resize-handle.ne { top: -6px; right: -6px; cursor: nesw-resize; }
      .resize-handle.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
      .resize-handle.se { bottom: -6px; right: -6px; cursor: nwse-resize; }
    
    `;
    document.head.appendChild(style);
  }
  
  const themeAPI = {injectStyles};
  window.themeAPI = themeAPI;

})();

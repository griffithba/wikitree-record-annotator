
// ============================================================
// MAIN TOOLBAR
// ============================================================

(() => {
  const tools = window.tools;

  // create toolbar
  function createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = "wt-toolbar";

    Object.assign(toolbar.style, {
      position: "fixed",
      top: "10px",
      right: "40px",
      zIndex: "100000",
      display: "flex",
      gap: "6px",
      padding: "6px",
      background: "var(--wt-toolbar-bg)",
      borderRadius: "8px"
    });
    
    // Add tool buttons to toolbar
    toolbar.appendChild(makeToolButton("Draw", "draw"));
    toolbar.appendChild(makeToolButton("Select", "select"));

    // Button for toggling show/hide annotations
    const toggleBtn = document.createElement("button");
    // initial button label
    toggleBtn.textContent = showAnnotations ? "Hide" : "Show";

    toggleBtn.addEventListener("click", () => {
      showAnnotations = !showAnnotations;
      toggleBtn.textContent = showAnnotations ? "Hide" : "Show";
      renderAnnotations();
    });

    // Add toggle button to toolbar
    toolbar.appendChild(toggleBtn);

    // attach the toolbar
    document.body.appendChild(toolbar);
  }


  /**
   * Creates a button for tool selection
   * @param {string} label - Button label text
   * @param {string} toolName - Tool identifier ("draw" | "select")
   * @returns {HTMLElement} Button element
   */
  function makeToolButton(label, toolName) {
    const btn = document.createElement("button");

    btn.textContent = label;
    btn.dataset.tool = toolName;

    Object.assign(btn.style, {
      padding: "6px 10px",
      fontSize: "12px",
      cursor: "pointer"
    });

    btn.addEventListener("click", () => {
      tools.setTool(toolName);
      updateToolUI();
      updateToolbarButtons();
    });

    return btn;
  }

  /**
   * Updates cursor style on annotation boxes based on active tool
   */
  function updateToolUI() {
    document.querySelectorAll(".wt-annotation").forEach(el => {
      if (tools.isSelecting()) {
        el.style.cursor = "pointer";
        el.style.pointerEvents = "auto";
      } else {
        el.style.cursor = "default";
        el.style.pointerEvents = "auto";
      }
    });

    overlay.style.cursor =
      tools.isDrawing() ? "crosshair" : "default";
  }

  /**
   * Updates toolbar button highlighting to show active tool
   */
  function updateToolbarButtons() {
    document.querySelectorAll("#wt-toolbar button").forEach(btn => {
      const btnTool = btn.dataset.tool;

      if (btnTool && btnTool === tools.getTool()) {
        btn.style.background = "#c33";
        btn.style.color = "white";
      } else {
        btn.style.background = "#eee";
        btn.style.color = "black";
      }
    });
  }


  // ============================================================
  // ANNOTATION TOOLBAR
  // ============================================================


  /**
   * Creates toolbar with ➕, ✏️, 🗑️ buttons for selected annotation
   * @param {string} id - Annotation ID
   * @returns {HTMLElement} Toolbar div
   */
  function createAnnotationToolbar(id) {
    const toolbar = document.createElement("div");
    toolbar.className = "annotation-toolbar";

    const addBtn = document.createElement("button");
    addBtn.textContent = "➕";
    addBtn.title = "Add box";

    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.title = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Delete";

    // "➕" button: toggle "add box to annotation" mode
    addBtn.onclick = (e) => {
      e.stopPropagation();

      if (!selectedAnnotationId) return;

      // Toggle behavior
      addingBoxToAnnotationId = addingBoxToAnnotationId ? null : selectedAnnotationId;
      overlay.style.pointerEvents = addingBoxToAnnotationId ? "auto" : "none";
      overlay.style.cursor = addingBoxToAnnotationId ? "crosshair" : "default";
    };
  
    // "✏️" button: open WT ID editor
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const box = e.target.closest(".wt-annotation");
      if (!box) return;
      const rect = box.getBoundingClientRect();
      editAnnotation(id, rect.left + rect.width, rect.top + rect.height);
    };

    // "🗑️" button: delete with confirmation
    deleteBtn.onclick = (e) => {
      e.stopPropagation();

      if (!deleteBtn.dataset.armed) {
        // First click: arm for deletion
        deleteBtn.dataset.armed = "true";
        deleteBtn.textContent = "⚠";
        deleteBtn.style.color = "yellow";
        deleteBtn.style.fontsize = "22px";
        deleteBtn.title = "Click again to delete";
        return;
      }

      // Second click: execute deletion
      const boxEl = deleteBtn.closest(".wt-annotation");
      const annotationId = boxEl.dataset.annotationId;
      const boxIndex = Number(boxEl.dataset.boxIndex);

      deleteBox(annotationId, boxIndex);
    };

    toolbar.append(addBtn, editBtn, deleteBtn);
    return toolbar;
  }


  window.ui = {
    createToolbar,
    updateToolUI,
    createAnnotationToolbar
  }

})();
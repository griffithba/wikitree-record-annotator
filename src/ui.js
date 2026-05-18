
// ============================================================
// MAIN TOOLBAR
// ============================================================

(() => {
  const tools = window.tools;
  const overlay = window.overlay;
  // Dialog element for editing annotation WT ID and notes
  let wtEditor = null;


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
    toggleBtn.textContent = overlay.isVisible() ? "Hide" : "Show";

    toggleBtn.addEventListener("click", () => {
      overlay.setVisible(!overlay.isVisible());
      toggleBtn.textContent = overlay.isVisible() ? "Hide" : "Show";
      overlay.renderAnnotations();
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

    overlay.setDrawingState(tools.isDrawing());
    //overlay.style.cursor =
    //  tools.isDrawing() ? "crosshair" : "default";
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
  // SECTION 7: ANNOTATION EDITOR (WT ID & NOTES)
  // ============================================================

  /**
   * Creates the modal dialog for editing WT ID and notes.
   * Dialog is hidden by default and shown via openWtEditor().
   * Only called at init.
   */
  function createWtEditor() {
    wtEditor = document.createElement("div");

    Object.assign(wtEditor.style, {
      position: "absolute",
      zIndex: 100001,
      background: "black",
      color: "white",
      padding: "6px",
      borderRadius: "6px",
      display: "none",
      flexDirection: "column",
      gap: "4px"
    });

    wtEditor.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:4px; font-family: Arial, sans-serif;">
      <div style="display:flex; align-items:center; gap:6px;">
        <span>WikiTree ID:</span>
        <input type="text" id="wt-input" style="width:120px;" />
      </div>

      <div style="display:flex; align-items:center; gap:6px;">
        <span>Optional note:</span>
        <input type="text" id="wt-note" style="width:180px;" />
      </div>

      <div style="display:flex; gap:6px;">
        <button id="wt-save">✔</button>
        <button id="wt-cancel">✖</button>
      </div>

      <div id="wt-error" style="color:red; font-size:11px;"></div>
    </div>  `;
  
    document.body.appendChild(wtEditor);

    const input = wtEditor.querySelector("#wt-input");
    const noteInput = wtEditor.querySelector("#wt-note");
    const saveBtn = wtEditor.querySelector("#wt-save");
    const cancelBtn = wtEditor.querySelector("#wt-cancel");

    // Handle Enter/Escape in input fields
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click();
      if (e.key === "Escape") cancelBtn.click();
    });
    noteInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click();
      if (e.key === "Escape") cancelBtn.click();
    });

    // Prevent dialog from being dragged away
    wtEditor.addEventListener("mousedown", e => e.stopPropagation()); 
  }

  /**
   * Validates WikiTree ID format (e.g., "Smith-123")
   * @param {string} id - Potential WikiTree ID
   * @returns {boolean} True if format is valid
   */
  function isPlausibleWtId(id) {
    return /^\p{L}+-\d+$/u.test(id);
  }

  /**
   * Opens the WT ID/note editor dialog at specified position
   * @param {Object} options
   * @param {number} options.x - Screen X position
   * @param {number} options.y - Screen Y position
   * @param {string} [options.initialValue=""] - Initial WT ID
   * @param {string} [options.initialNote=""] - Initial note
   * @param {Function} [options.onSave] - Callback with {wtId, note}
   * @param {Function} [options.onCancel] - Callback on cancel
   */
  function openWtEditor(
      { x, y, initialValue = "", initialNote = "", onSave, onCancel }) 
    {
      const input = wtEditor.querySelector("#wt-input");
      const noteInput = wtEditor.querySelector("#wt-note");
      const saveBtn = wtEditor.querySelector("#wt-save");
      const cancelBtn = wtEditor.querySelector("#wt-cancel");
      const errorEl = wtEditor.querySelector("#wt-error");

      wtEditor.style.left = x + "px";
      wtEditor.style.top = y + "px";
      wtEditor.style.display = "flex";

      input.value = initialValue;
      input.focus();
      noteInput.value = initialNote;

      // Cleanup helper
      function cleanup() {
        wtEditor.style.display = "none";
        saveBtn.onclick = null;
        cancelBtn.onclick = null;
      }
  
      saveBtn.onclick = () => {
        const value = input.value.trim();
        const note = noteInput.value.trim();
      
        if (!value) {
          errorEl.textContent = "ID required";
          return;
        }

        if (!isPlausibleWtId(value)) {
          errorEl.textContent = "Invalid format (e.g., Smith-123)";
          return;
        }

        errorEl.textContent = "";
        cleanup();
        onSave?.({wtId: value, note: note});
    };

    cancelBtn.onclick = () => {
      cleanup();
      onCancel?.();
    };
  }

  /**
   * Closes the WT ID/note editor dialog
   */
  function closeWtEditor() {
    if (wtEditor) {
      wtEditor.style.display = "none";
    }
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
    createAnnotationToolbar,
    createWtEditor,
    openWtEditor,
    closeWtEditor
  }

})();
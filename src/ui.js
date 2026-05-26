
// ============================================================
// MAIN TOOLBAR
// ============================================================

(() => {
  "use strict";

  const tools = window.tools;
  const overlay = window.overlay;
  const backup = window.backup;
  
  // Dialog element for editing annotation WT ID and notes
  let _wtEditor = null;

  // Utility panel for import/export (created in createToolbar)
  let _utilPanel = null; 

  function createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = "wt-toolbar";

    Object.assign(toolbar.style, {
      position: "fixed",
      bottom: "5px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "100000",
      display: "flex",
      gap: "6px",
      padding: "6px",
      background: "var(--wt-toolbar-bg)",
      borderRadius: "8px"
    });

    //
    // Header
    //

    const header = document.createElement("div");

    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontWeight: "bold",
      fontSize: "14px"
    });

    const icon = document.createElement("img");

    icon.src = chrome.runtime.getURL(
      "icons/icon32.png"
    );

    Object.assign(icon.style, {
      width: "24px",
      height: "24px"
    });

    const title = document.createElement("div");
    title.textContent = "WikiTree Annotator";

    header.appendChild(icon);
    header.appendChild(title);

    toolbar.appendChild(header);

    //
    // Button row
    //

    const buttonRow = document.createElement("div");

    Object.assign(buttonRow.style, {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap"
    });

    // Add tool buttons to button row
    buttonRow.appendChild(_makeToolButton("Draw", "draw"));
    buttonRow.appendChild(_makeToolButton("Select", "select"));

    // Button for toggling show/hide annotations
    const toggleBtn = document.createElement("button");
    // initial button label
    toggleBtn.textContent = overlay.isVisible() ? "Hide" : "Show";

    toggleBtn.addEventListener("click", () => {
      overlay.setVisible(!overlay.isVisible());
      toggleBtn.textContent = overlay.isVisible() ? "Hide" : "Show";
      overlay.renderAnnotations();
    });

    // Add toggle button to button row
    buttonRow.appendChild(toggleBtn);

    // create utility panel
    _utilPanel = _makeUtilPanel();
    
    // button for import/export annotations from/to a file
    const utilBtn = document.createElement("button");
    utilBtn.textContent = "💾";
    utilBtn.title = "Import/Export";
    utilBtn.addEventListener("click", () => {
      _utilPanel.style.display = _utilPanel.style.display === "flex" ? "none" : "flex";
    });

    // Add import/export button to button row
    buttonRow.appendChild(utilBtn);

    // Add button row to toolbar
    toolbar.appendChild(buttonRow);
    
    // attach the toolbar
    document.body.appendChild(toolbar);
    // attach the (hidden for now) utility panel
    document.body.appendChild(_utilPanel); 
  }


  /**
   * Creates a button for tool selection
   * @param {string} label - Button label text
   * @param {string} toolName - Tool identifier ("draw" | "select")
   * @returns {HTMLElement} Button element
   */
  function _makeToolButton(label, toolName) {
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
      _updateToolbarButtons();
    });

    return btn;
  }


  function _makeUtilPanel() {
    const panel = document.createElement("div");

    Object.assign(panel.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      zIndex: "100001",
      transform: "translate(-50%, -50%)",
      padding: "8px",
      background: "var(--wt-toolbar-bg)",
      borderRadius: "8px",
      display: "none",
      flexDirection: "column",
      gap: "6px"
    });

    //
    // Export button
    //

    const exportRow = document.createElement("div");

    Object.assign(exportRow.style, {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "6px"
    });

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export";

    const exportText = document.createElement("span");
    exportText.textContent = "all annotations to a JSON file";

     exportBtn.addEventListener("click", async () => {
      const outputFile = "wikitree_annotations_" + getLocalTimestamp() + ".json";
      await backup.exportAnnotations(outputFile);
    });
       
    exportRow.appendChild(exportBtn);
    exportRow.appendChild(exportText);

    panel.appendChild(exportRow);

    //
    // Import button
    //

    const importRow = document.createElement("div");

    Object.assign(importRow.style, {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "6px"
    });

    const importBtn = document.createElement("button");
    importBtn.textContent = "Import";

    const importText = document.createElement("span");
    importText.textContent = "annotations from a JSON file";

    importBtn.addEventListener("click", () => {
      const input = document.createElement("input");

      input.type = "file";
      input.accept = ".json";

      input.addEventListener("change", async (e) => {
        const inputFile = e.target.files[0];

        if (inputFile) {
          await backup.importAnnotations(inputFile);
        }
      });
      input.click();
    });

    importRow.appendChild(importBtn);
    importRow.appendChild(importText);

    panel.appendChild(importRow);

    const warningText = document.createElement("div");
    
    warningText.textContent = "⚠ Importing will overwrite all existing annotations!";
    
    panel.appendChild(warningText);

    return (panel);
  }

  
  function getLocalTimestamp() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-11
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
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
  }


  /**
   * Updates toolbar button highlighting to show active tool
   */
  function _updateToolbarButtons() {
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
  // ANNOTATION EDITOR (WT ID & NOTES)
  // ============================================================

  /**
   * Creates the modal dialog for editing WT ID and notes.
   * Dialog is hidden by default and shown via openWtEditor().
   * Only called at init.
   */
  function createWtEditor() {
    _wtEditor = document.createElement("div");

    Object.assign(_wtEditor.style, {
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

    _wtEditor.innerHTML = `
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
  
    document.body.appendChild(_wtEditor);

    const input = _wtEditor.querySelector("#wt-input");
    const noteInput = _wtEditor.querySelector("#wt-note");
    const saveBtn = _wtEditor.querySelector("#wt-save");
    const cancelBtn = _wtEditor.querySelector("#wt-cancel");

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
    _wtEditor.addEventListener("mousedown", e => e.stopPropagation()); 
  }


  /**
   * Validates WikiTree ID format (e.g., "Smith-123")
   * @param {string} id - Potential WikiTree ID
   * @returns {boolean} True if format is valid
   */
  function _isPlausibleWtId(id) {
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
      const input = _wtEditor.querySelector("#wt-input");
      const noteInput = _wtEditor.querySelector("#wt-note");
      const saveBtn = _wtEditor.querySelector("#wt-save");
      const cancelBtn = _wtEditor.querySelector("#wt-cancel");
      const errorEl = _wtEditor.querySelector("#wt-error");

      _wtEditor.style.left = x + "px";
      _wtEditor.style.top = y + "px";
      _wtEditor.style.display = "flex";

      input.value = initialValue;
      input.focus();
      noteInput.value = initialNote;

      // Cleanup helper
      function cleanup() {
        _wtEditor.style.display = "none";
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

        if (!_isPlausibleWtId(value)) {
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
    if (_wtEditor) {
      _wtEditor.style.display = "none";
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

      if (!tools.getSelectedAnnotationId()) return;

      // Toggle behavior
      tools.setAddingBoxToAnnotationId(tools.isAddingBoxToAnnotationId() ? null : tools.getSelectedAnnotationId());
      overlay.setDrawingState(tools.isAddingBoxToAnnotationId());
    };
  
    // "✏️" button: open WT ID editor
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const box = e.target.closest(".wt-annotation");
      if (!box) return;
      const rect = box.getBoundingClientRect();
      tools.editAnnotation(id, rect.left + rect.width, rect.top + rect.height);
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

      annotationsAPI.deleteBox(annotationId, boxIndex);
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

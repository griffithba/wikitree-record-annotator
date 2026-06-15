
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
    // Make sure there is no stale toolbar from a previous page instance
    document.getElementById("wt-toolbar")?.remove();
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
    header.addEventListener("mousedown", startDrag);

    toolbar.appendChild(header);

    // Make the toolbar draggable
    function startDrag(e) {
      const rect = toolbar.getBoundingClientRect();

      // Convert from bottom-centered positioning
      // to top-left positioning.
      toolbar.style.left = `${rect.left}px`;
      toolbar.style.top = `${rect.top}px`;

      toolbar.style.bottom = "auto";
      toolbar.style.transform = "none";

      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      function drag(e) {
        toolbar.style.left = `${e.clientX - offsetX}px`;
        toolbar.style.top = `${e.clientY - offsetY}px`;
      }

      function stop() {
        document.removeEventListener("mousemove", drag);
        document.removeEventListener("mouseup", stop);
      }

      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", stop);
    }

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
    buttonRow.appendChild(_makeToolButton(
      "Draw", 
      "draw", 
      async () => {
        const person = await _showDrawDialog();

        if (!person) {
          console.log("Draw cancelled");
          return;
        }

        tools.setActiveDrawingPerson(person.wikitreeid);
        tools.setTool("draw");
        updateToolUI();
        //_updateToolbarButtons();
      }
    ));
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
    
    // Add button row to toolbar
    toolbar.appendChild(buttonRow);
    
    // attach the toolbar
    document.body.appendChild(toolbar);
  }


  // Display a dialog with list of annotated and unannotated profiles for the current page, and 
  // let user select one to start drawing annotation frames for that profile. Returns the selected 
  // profile object or null if dialog was cancelled.
  async function _showDrawDialog() {
    const key = archiveProvider.getCurrentPageKey();
    const referrers = await wtplusAPI.getPageReferrers(key.site, key.book, key.page);

    const annotatedProfiles = annotationsAPI.getAnnotations();
    const annotatedIds = annotatedProfiles.map(p => p.wikitreeid);

    const unannotatedReferrers = referrers.filter(r => !annotatedIds.includes(r.wikitreeid));
    const unannotatedIds = unannotatedReferrers.map(r => r.wikitreeid);

    console.log("Annotated profiles:", annotatedIds);
    console.log("Unannotated profiles:", unannotatedIds);

    return new Promise(resolve => {

      // --------------------------------------------------
      // backdrop
      // --------------------------------------------------

      const backdrop = document.createElement("div");

      Object.assign(backdrop.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.4)",
        zIndex: "100000"
      });

      // --------------------------------------------------
      // dialog
      // --------------------------------------------------

      const dialog = document.createElement("div");

      Object.assign(dialog.style, {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "white",
        padding: "16px",
        borderRadius: "8px",
        minWidth: "500px",
        maxHeight: "80vh",
        overflowY: "auto"
      });

      backdrop.appendChild(dialog);

      // --------------------------------------------------
      // title
      // --------------------------------------------------

      const title = document.createElement("h3");
      title.textContent = "Select profile for annotation";
      dialog.appendChild(title);

      // --------------------------------------------------
      // two-column container
      // --------------------------------------------------

      const columns = document.createElement("div");

      Object.assign(columns.style, {
        display: "flex",
        gap: "24px"
      });

      dialog.appendChild(columns);

      // --------------------------------------------------
      // left column
      // --------------------------------------------------

      const left = document.createElement("div");

      Object.assign(left.style, {
        flex: "1"
      });

      columns.appendChild(left);

      const leftHeader = document.createElement("h4");
      leftHeader.textContent = "New annotation for:";
      left.appendChild(leftHeader);

      // --------------------------------------------------
      // right column
      // --------------------------------------------------

      const right = document.createElement("div");

      Object.assign(right.style, {
        flex: "1"
      });

      columns.appendChild(right);

      const rightHeader = document.createElement("h4");
      rightHeader.textContent = "Add box(es) to:";
      right.appendChild(rightHeader);

      // --------------------------------------------------
      // helper for radio rows
      // --------------------------------------------------

      function addRadioRow(parent, value) {

        const label = document.createElement("label");

        Object.assign(label.style, {
          display: "block",
          marginBottom: "4px"
        });

        const radio = document.createElement("input");

        radio.type = "radio";
        radio.name = "wt-draw-target";
        radio.value = value;

        label.appendChild(radio);
        label.append(" " + value);

        parent.appendChild(label);

        return radio;
      }

      // --------------------------------------------------
      // unannotated list
      // --------------------------------------------------

      unannotatedIds.forEach(id => {
        addRadioRow(left, id);
      });

      // --------------------------------------------------
      // custom WT ID
      // --------------------------------------------------

      const otherLabel = document.createElement("label");

      Object.assign(otherLabel.style, {
        display: "block",
        marginTop: "12px"
      });

      const otherRadio = document.createElement("input");

      otherRadio.type = "radio";
      otherRadio.name = "wt-draw-target";

      const otherInput = document.createElement("input");

      otherInput.type = "text";
      otherInput.placeholder = "Other WT ID";

      otherInput.addEventListener("focus", () => {
        otherRadio.checked = true;
      });

      otherLabel.appendChild(otherRadio);
      otherLabel.append(" Other: ");
      otherLabel.appendChild(otherInput);

      left.appendChild(otherLabel);

      // --------------------------------------------------
      // annotated list
      // --------------------------------------------------

      annotatedIds.forEach(id => {
        addRadioRow(right, id);
      });

      // --------------------------------------------------
      // buttons
      // --------------------------------------------------

      const buttonRow = document.createElement("div");

      Object.assign(buttonRow.style, {
        marginTop: "16px",
        textAlign: "right"
      });

      dialog.appendChild(buttonRow);

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";

      const goBtn = document.createElement("button");
      goBtn.textContent = "Go";

      Object.assign(goBtn.style, {
        marginLeft: "8px"
      });

      buttonRow.appendChild(cancelBtn);
      buttonRow.appendChild(goBtn);

      // --------------------------------------------------
      // handlers
      // --------------------------------------------------

      cancelBtn.addEventListener("click", () => {
        backdrop.remove();
        resolve(null);
      });

      goBtn.addEventListener("click", () => {

        let selectedId = null;

        const selectedRadio =
          dialog.querySelector(
            'input[name="wt-draw-target"]:checked'
          );

        if (!selectedRadio) {
          alert("Select a profile.");
          return;
        }

        if (selectedRadio === otherRadio) {

          selectedId =
            otherInput.value.trim();

        } else {

          selectedId =
            selectedRadio.value;
        }

        if (!selectedId) {
          alert("Enter a WikiTree ID.");
          return;
        }

        backdrop.remove();

        resolve({
          wikitreeid: selectedId
        });
      });

      document.body.appendChild(backdrop);
    });
  } 


  /**
   * Creates a button for tool selection
   * @param {string} label - Button label text
   * @param {string} toolName - Tool identifier ("draw" | "select")
   * @param {Function} onClick - Optional custom click handler
   * @returns {HTMLElement} Button element
   */
  function _makeToolButton(label, toolName, onClick = null) {
    const btn = document.createElement("button");

    btn.textContent = label;
    btn.dataset.tool = toolName;

    Object.assign(btn.style, {
      padding: "6px 10px",
      fontSize: "12px",
      cursor: "pointer"
    });

    btn.addEventListener("click", async () => {
      if (onClick) {
        await onClick();
      } else {
        tools.setTool(toolName);
        updateToolUI();
        //_updateToolbarButtons();
      }
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

    _updateToolbarButtons();

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
   * Creates toolbar with ✏️, 🗑️ buttons for selected annotation
   * @param {string} id - Annotation ID
   * @returns {HTMLElement} Toolbar div
   */
  function createAnnotationToolbar(id) {
    const toolbar = document.createElement("div");
    toolbar.className = "annotation-toolbar";

    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.title = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Delete";
  
    // "✏️" button: open WT ID editor
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const frame = e.target.closest(".wt-annotation");
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const frameId = Number(frame.dataset.frameId);
      tools.editFrame(id, frameId, rect.left + rect.width, rect.top + rect.height);
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

    toolbar.append(editBtn, deleteBtn);
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

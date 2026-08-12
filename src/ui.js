
// ============================================================
// MAIN TOOLBAR
// ============================================================

(() => {
  "use strict";

  const tools = window.tools;
  const overlay = window.overlay;
  
  // Dialog element for editing annotation WT ID and notes
  let _wtEditor = null;

  const _unannotatedCountDisplay = document.createElement("div");
  _unannotatedCountDisplay.id = "wt-unannotated-count";

  async function createToolbar() {
    // Make sure there is no stale toolbar from a previous page instance
    document.getElementById("wt-toolbar")?.remove();
    
    const toolbar = _createToolbarElement();

    const header = await _createToolbarHeader(toolbar);

    toolbar.appendChild(header);

    const container = _createToolbarContainer();

    const content = _createNormalToolbarContent();
    
    container.appendChild(content);
    toolbar.appendChild(container);
    
    // attach the toolbar
    document.body.appendChild(toolbar);

    _prepareForDragging(toolbar);
    _makeDraggable(header, toolbar);
  }


  function _createToolbarElement() {
    const toolbar = document.createElement("div");
    toolbar.id = "wt-toolbar";

    // Get positioning styles from the active provider, or fallback to default
    const providerStyles = archiveProvider.getToolbarPosition ? 
      archiveProvider.getToolbarPosition() : 
      { bottom: "5px", left: "50%", transform: "translateX(-50%)" };

    // Build baseline styles
    const baseStyles = {
      position: "fixed",
      zIndex: "100000",
      display: "flex",
      gap: "6px",
      padding: "6px",
      background: "var(--wt-toolbar-bg)",
      borderRadius: "8px"
    };

    // Merge them together cleanly
    Object.assign(toolbar.style, baseStyles, providerStyles);
    return toolbar;
  }


  async function _createToolbarHeader(toolbar) {
    const header = document.createElement("div");

    header.id = "wt-toolbar-header";

    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "4px 8px",
      border: "1px solid #888",
      borderRadius: "6px",
      fontWeight: "bold",
      fontSize: "14px",
      cursor: "grab"
    });

    const icon = document.createElement("img");
    icon.draggable = false;
    icon.src = chrome.runtime.getURL(
      "icons/icon32.png"
    );

    Object.assign(icon.style, {
      width: "32px",
      height: "32px",
      pointerEvents: "none"
    });

    header.appendChild(icon);

    const title = document.createElement("div");
    title.innerHTML = "WikiTree<br>Annotator";
    header.appendChild(title);

    const info = document.createElement("div");

    Object.assign(info.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      marginLeft: "8px"
    });

    const { unannotatedIds } = await _getProfilesForCurrentPage();
    const unannotatedCount = unannotatedIds.length;

    _unannotatedCountDisplay.textContent = unannotatedCount;
    _unannotatedCountDisplay.title = `${unannotatedCount} unannotated profiles on this page`;
    Object.assign(_unannotatedCountDisplay.style, {
      fontSize: "12px",
      fontWeight: "bold",
      color: "#c00"
    });

    info.appendChild(_unannotatedCountDisplay);

    const versionText = document.createElement("div");
    versionText.textContent = `v${chrome.runtime.getManifest().version}`;

    Object.assign(versionText.style, {
      fontSize: "10px",
      color: "#272727",
      marginTop: "2px"
    });

    info.appendChild(versionText);
    header.appendChild(info);
    
    return header;
  }


  async function updateUnannotatedCount() {
    const { unannotatedIds } = await _getProfilesForCurrentPage();
    const count = unannotatedIds.length;

    _unannotatedCountDisplay.textContent = count || "";
    _unannotatedCountDisplay.style.display = count ? "" : "none";
    _unannotatedCountDisplay.title = `${count} unannotated profiles on this page`;
}

  function _prepareForDragging(element) {
    const rect = element.getBoundingClientRect();

    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;

    element.style.bottom = "auto";
    element.style.right = "auto";

    element.style.transform = "none";
  }
  

  function _makeDraggable(handle, element) {
    handle.addEventListener("mousedown", e => {
      e.preventDefault();

       const rect = element.getBoundingClientRect();
       const offsetX = e.clientX - rect.left;
       const offsetY = e.clientY - rect.top;

       function drag(e) {
         element.style.left = `${e.clientX - offsetX}px`;
         element.style.top = `${e.clientY - offsetY}px`;
       }

       function stop() {
         document.removeEventListener("mousemove", drag);
         document.removeEventListener("mouseup", stop);
       }

       document.addEventListener("mousemove", drag);
       document.addEventListener("mouseup", stop);
     });
  }


  function _createToolbarContainer() {
    const content = document.createElement("div");

    content.id = "wt-toolbar-content";

    Object.assign(content.style, {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap"
    });

    return content;
  }

  function _createNormalToolbarContent() {

    const fragment = document.createDocumentFragment();

    // Add tool buttons
    fragment.appendChild(_makeButton({
      label: "Draw",
      title: "Draw a new frame",
      tool: "draw",
      onClick: async () => {
        const person = await _showDrawDialog();
        if (!person) return;

        // if an annotation already exists go into add-a-frame mode
        if (person.hasAnnotation) tools.selectAnnotation(person.wikitreeid);
        // otherwise go into draw-new-annotation mode
        else tools.setActiveDrawingPerson(person.wikitreeid);
        setToolbarMode("edit");
        tools.setTool("draw")
        updateToolUI();
      }
    }));

    fragment.appendChild(_makeButton({
      label: "Edit",
      title: "Edit existing frames",
      tool: "edit"
    }));

    // Button for toggling show/hide annotations
    fragment.appendChild(_makeButton({
      label: overlay.isVisible() ? "Hide" : "Show",

      title: overlay.isVisible() ? "Hide all Annotations" : "Show all Annotations",

      onClick: (btn) => {
        const visible = !overlay.isVisible();

        overlay.setVisible(visible);

        const label = visible ? "Hide" : "Show";
        btn.textContent = label;
        btn.title = `${label} all Annotations`;

        overlay.renderAnnotations();
      }
    }));

    updateUnannotatedCount();

    return fragment;
  }


  /**
   * Creates a button for the toolbar
   * @param {string} label - Button label text
   * @param {string} toolName - Optional tool identifier
   * @param {Function} onClick - Optional custom click handler
   * @returns {HTMLElement} Button element
   */
  function _makeButton({
    label,
    title = null,
    tool = null,
    onClick = null
  }) {
    const btn = document.createElement("button");

    btn.textContent = label;

    if (title) btn.title = title;

    if (tool) {
      btn.dataset.tool = tool;
    }

    Object.assign(btn.style, {
      padding: "6px 10px",
      fontSize: "14px",
      borderRadius: "6px",
      cursor: "pointer"
    });

    btn.addEventListener("click", async () => {
      if (onClick) {
        await onClick(btn);
      } else if (tool) {
        tools.setTool(tool);
        updateToolUI();
      }
    });

    return btn;
  }


  function setToolbarMode(mode) {
    const content = document.getElementById("wt-toolbar-content");

    switch (mode) {
        case "normal":
            content.replaceChildren(_createNormalToolbarContent());
            break;

        case "edit":
            content.replaceChildren(_createEditPanel());
            break;
    }
  }


  function _createEditPanel() {
    const fragment = document.createDocumentFragment();

    const title = document.createElement("div");
    let id = tools.getSelectedAnnotationId();
    let actionWord = "Editing";
    if (!id) {
      id = tools.getActiveDrawingPerson();
      actionWord = "Drawing";
    }
    const name = personAPI.getName(id);
    const birth = personAPI.getBirthDate(id);
    const birthString = birth ? `b. ${birth}` : "";
    const death = personAPI.getDeathDate(id);
    const deathString = death ? `d. ${death}` : "";
    title.innerHTML = `${actionWord} annotation for ${name}<br>${birthString}  ${deathString}`;
    fragment.appendChild(title);

    if (actionWord === "Editing") {
      fragment.appendChild(_makeButton({
        label: "➕",
        title: "Add another frame to this annotation",
        onClick: (btn) => {
          // Toggle behavior              
          tools.setActiveDrawingPerson(tools.getSelectedAnnotationId());
          tools.setTool("draw");
          updateToolUI();
        }
      }));
    }

    fragment.appendChild(_makeButton({
      label: "Cancel",
      title: "Cancel without saving", 
      onClick: (btn) => {
        tools.cancelChanges();
        tools.setTool(null)
      }
    }));

    if (actionWord === "Editing") {
      fragment.appendChild(_makeButton({
        label: "Done",
        title: "Save changes",
        onClick: (btn) => {
          tools.clearSelection();
          tools.setTool(null)
        }
      }))
    }

    return fragment;
  }


  // Returns the lists of annotated and unannotated profiles for the current page
  async function _getProfilesForCurrentPage() {
    const key = archiveProvider.getCurrentPageKey();
    const referrers = await wtplusAPI.getPageReferrers(key.site, key.book, key.page);

    const annotatedProfiles = annotationsAPI.getAnnotations();
    const annotatedIds = annotatedProfiles.map(p => p.wikitreeid);

    const unannotatedReferrers = referrers.filter(r => !annotatedIds.includes(r.wikitreeid));
    const unannotatedIds = unannotatedReferrers.map(r => r.wikitreeid);

    return { annotatedIds, unannotatedIds };
  }


  // Display a dialog with list of annotated and unannotated profiles for the current page, and 
  // let user select one to start drawing annotation frames for that profile. Returns the selected 
  // profile object or null if dialog was cancelled.
  async function _showDrawDialog() {
    const { annotatedIds, unannotatedIds } = await _getProfilesForCurrentPage();

    // pre-fetch person data for all unannotated IDs simultaneously (annotated IDs were already pre-fetched)
    await Promise.all(unannotatedIds.map(async wtId => personAPI.prefetch(wtId)));

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
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "white",
        padding: "16px",
        borderRadius: "8px",
        minWidth: annotatedIds.length > 0 ? "500px" : "320px",
        maxHeight: "80vh",
        overflowY: "auto"
      });

      backdrop.appendChild(dialog);

      // --------------------------------------------------
      // title
      // --------------------------------------------------

      const title = document.createElement("h3");
      title.textContent = "Select profile for annotation";
      title.style.cursor = "grab"; 
      title.style.userSelect = "none";

      dialog.appendChild(title);

      // --------------------------------------------------
      // two-column container
      // --------------------------------------------------

      const columns = document.createElement("div");

      Object.assign(columns.style, {
        display: annotatedIds.length > 0 ? "flex" : "block",
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
      if (annotatedIds.length > 0) {
        Object.assign(right.style, {
          flex: "1"
        });

        columns.appendChild(right);

        const rightHeader = document.createElement("h4");
        rightHeader.textContent = "Add frame to:";
        right.appendChild(rightHeader);
      }

      // --------------------------------------------------
      // helper for radio rows
      // --------------------------------------------------

      function addRadioRow(parent, wtId, displayText, tooltipText, showLink = false) {

        const label = document.createElement("label");

        Object.assign(label.style, {
          display: "block",
          marginBottom: "4px"
        });

        if (tooltipText) {
          label.title = tooltipText;
        }

        const radio = document.createElement("input");

        radio.type = "radio";
        radio.name = "wt-draw-target";
        radio.value = wtId;

        label.appendChild(radio);
        label.append(" " + displayText);

        if (showLink) {
          label.append(" ");

          const link = document.createElement("a");
          link.href = `https://www.wikitree.com/wiki/${encodeURIComponent(wtId)}`;
          link.textContent = "🔗profile";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.style.fontSize = "0.85em";

          // Prevent clicking the link from selecting the radio button.
          link.addEventListener("click", e => {
            e.stopPropagation();
          });

          label.appendChild(link);
        }

        parent.appendChild(label);

        return radio;
      }

      // --------------------------------------------------
      // unannotated list
      // --------------------------------------------------
      let toolTip = null;

      unannotatedIds.forEach(id => {
        const exactBirth = personAPI.getBirthDate(id);
        if (exactBirth && exactBirth.length > 4) toolTip = `Born ${exactBirth}`;
        else toolTip = null;

        addRadioRow(left, id, personAPI.formatDisplayName(id), toolTip, true);
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
        const exactBirth = personAPI.getBirthDate(id);
        if (exactBirth && exactBirth.length > 4) toolTip = `Born ${exactBirth}`;
        else toolTip = null;

        addRadioRow(right, id, personAPI.formatDisplayName(id), toolTip);
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

        const hasAnnotation = annotatedIds.includes(selectedId);

        backdrop.remove();

        resolve({
          wikitreeid: selectedId,
          hasAnnotation
        });
      });

      document.body.appendChild(backdrop);

      _prepareForDragging(dialog);
      _makeDraggable(title, dialog);
    });
  } 


  /**
   * Updates cursor style on annotation boxes based on active tool
   */
  function updateToolUI() {
    const selectedId = tools.getSelectedAnnotationId();

    document.querySelectorAll(".wt-annotation").forEach(el => {
      const id = el.dataset.annotationId;
      if (tools.isSelecting() &&
          (!selectedId || id === selectedId)) {
        el.style.cursor = "pointer";
      } else {
        el.style.cursor = "default";
      }
      el.style.pointerEvents = "auto";
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
  // ANNOTATION EDITOR (NOTES)
  // ============================================================

  /**
   * Creates the modal dialog for editing notes.
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

    const noteInput = _wtEditor.querySelector("#wt-note");
    const saveBtn = _wtEditor.querySelector("#wt-save");
    const cancelBtn = _wtEditor.querySelector("#wt-cancel");

    // Handle Enter/Escape in input fields
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
   * Opens the WT note editor dialog at specified position
   * @param {Object} options
   * @param {number} options.x - Screen X position
   * @param {number} options.y - Screen Y position
   * @param {string} [options.initialNote=""] - Initial note
   * @param {Function} [options.onSave] - Callback with {wtId, note}
   * @param {Function} [options.onCancel] - Callback on cancel
   */
  function openWtEditor(
      { x, y, initialNote = "", onSave, onCancel }) 
    {
      const input = _wtEditor.querySelector("#wt-input");
      const noteInput = _wtEditor.querySelector("#wt-note");
      const saveBtn = _wtEditor.querySelector("#wt-save");
      const cancelBtn = _wtEditor.querySelector("#wt-cancel");
      const errorEl = _wtEditor.querySelector("#wt-error");

      _wtEditor.style.left = x + "px";
      _wtEditor.style.top = y + "px";
      _wtEditor.style.display = "flex";

      noteInput.value = initialNote;
      noteInput.focus();

      // Cleanup helper
      function cleanup() {
        _wtEditor.style.display = "none";
        saveBtn.onclick = null;
        cancelBtn.onclick = null;
      }
  
      saveBtn.onclick = () => {
        const note = noteInput.value.trim();
        cleanup();
        onSave?.({note: note});
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
   * Creates toolbar with 📝, 🗑️/↩️ buttons for selected annotation
   * @param {string} id - Annotation ID
   * @returns {HTMLElement} Toolbar div
   */
  function createAnnotationToolbar(id, frameIndex) {

    const toolbar = document.createElement("div");
    toolbar.className = "annotation-toolbar";

    const annotation = annotationsAPI.getAnnotationByWtId(id);
    const frame = annotation.frames[frameIndex];
    const deleteBtn = document.createElement("button");
    const editBtn = document.createElement("button");

    if (frame._delete) {
      deleteBtn.textContent = "↩️";
      deleteBtn.title = "Restore";
    } else {
      deleteBtn.textContent = "🗑️";
      deleteBtn.title = "Delete";

      editBtn.textContent = "📝";
      editBtn.title = "Notes";

      // "📝" button: open annotation note editor
      editBtn.onclick = (e) => {
        e.stopPropagation();
        const frame = e.target.closest(".wt-annotation");
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        const frameIndex = Number(frame.dataset.frameIndex);
        tools.editFrame(id, frameIndex, rect.left + rect.width, rect.top + rect.height);
      };
    }

    // 🗑️/↩️ button: delete/restore annotation frame
    deleteBtn.onclick = (e) => {
      e.stopPropagation();

      if (frame._delete) {
        annotationsAPI.unmarkForDeletion(id, frameIndex);
      } else {
        annotationsAPI.markForDeletion(id, frameIndex);
      }
      overlay.renderAnnotations();

    };

    toolbar.append(editBtn, deleteBtn);
    return toolbar;
  }


  window.ui = {
    createToolbar,
    setToolbarMode,
    updateToolUI,
    updateUnannotatedCount,
    createAnnotationToolbar,
    createWtEditor,
    openWtEditor,
    closeWtEditor
  }

})();

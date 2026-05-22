(() => {
  "use strict";

  async function importAnnotations(file) {
      const text =
        await file.text();

      const data =
        JSON.parse(text);

      if (!Array.isArray(data.annotations)) {
        alert("Invalid annotation file");
        return;
      }

      await storageAPI.saveAnnotations(data.annotations);

      overlay.renderAnnotations();
  }


  async function exportAnnotations() {
    const annotations = await storageAPI.getAnnotations();

    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            annotations
          },
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "wikitree-annotations.json";

    a.click();

    URL.revokeObjectURL(url);
  }

  window.backup = {
    importAnnotations,
    exportAnnotations
  }
})();

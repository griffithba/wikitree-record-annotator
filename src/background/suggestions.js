chrome.runtime.sendMessage(
  { type: "GET_SUGGESTIONS" },
  suggestions => {

    const container =
      document.getElementById("suggestions");

    if (!suggestions.length) {
      container.textContent =
        "No suggestions.";
      return;
    }

    const header = document.createElement("h2");

    const possessivePronoun =
      suggestions[0].gender === "Male" ? "his" :
      suggestions[0].gender === "Female" ? "her" :
      "their";

    const sourcePhrase = suggestions.length === 1 ? "source which is" : "sources which are";

    header.textContent = 
      `${suggestions[0].name} is annotated in the following ${sourcePhrase} not cited in ${possessivePronoun} profile:`;
    
    container.appendChild(header);

    suggestions.forEach(citation => {

      const copyIcon = document.createElement("span");

      copyIcon.textContent = "⧉";
      copyIcon.title = "Copy citation";
      
      Object.assign(copyIcon.style, {
        cursor: "pointer",
        marginLeft: "8px",
        fontSize: "16px",
        userSelect: "none"
      });

      copyIcon.addEventListener("click", async() => {
        await navigator.clipboard.writeText(citation.citation);
        copyIcon.textContent = "✓";
        copyIcon.title = "Citation copied!";
        setTimeout(() => {
          copyIcon.textContent = "⧉";
          copyIcon.title = "Copy citation";
        }, 2000);
      });

      copyIcon.addEventListener("mouseenter", () => {
        copyIcon.style.opacity = "0.6";
      });

      copyIcon.addEventListener("mouseleave", () => {
        copyIcon.style.opacity = "1";
      });

      const item = document.createElement("div");

      item.style.marginBottom = "12px";

      item.innerHTML = `
        <strong>
          ${citation.citation}
        </strong>
        <br>
        <a href="${citation.url}"
          target="_blank">
          Open source
        </a>
      `;

      item.appendChild(copyIcon);
      container.appendChild(item);
    });

  }
);

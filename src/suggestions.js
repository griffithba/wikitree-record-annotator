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

    if (suggestions.length === 1) {
      header.textContent = 
        `${suggestions[0].wtId} is annotated in the following source which is not cited in their profile:`;
    } else {
      header.textContent = 
        `${suggestions[0].wtId} is annotated in the following sources which are not cited in their profile:`;
    }
    
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

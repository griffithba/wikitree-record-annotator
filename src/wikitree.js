(() => {
  const archiveProviders = window.archiveProviders;

  const pageData = document.getElementById("pageData")?.dataset;
  const name = `${pageData.mfirstname} ${pageData.mlastnameatbirth}`; 
  const wtId = pageData.mnamedb;

  async function processCitationLinks() {

    const missingCitations = [];

    // mark sources that have annotations for this profile, and 
    // inject wtId into citation links, and
    // find annotated pages that aren't cited
    for (const provider of archiveProviders) {
      // find all links on the page that point to this provider
      const links = [
        ...document.querySelectorAll(
          `a[href*="${provider.site}"]`
        )
      ];

      // only try to fetch all annotations for a profile if there's at least one link for this source already listed on the profile page
      if (links.length > 0) {
        const profileAnnotations = await wtplusAPI.getFramesForProfile(provider.site, wtId);
        const annotatedPages = new Set(profileAnnotations.map(a => `${a.site}|${a.book}|${a.page}`));
        const citedPages = new Set();
      
        for (const link of links) {
          const keyObj = provider.getPageKey(link.href);
          if (!keyObj) continue;  // skip if we can't extract a key from the link
          const key = `${keyObj.site}|${keyObj.book}|${keyObj.page}`

          citedPages.add(key);

          if (annotatedPages.has(key)) {
            addAnnotationMarker(link);
          }

          injectWtIdIntoCitationLink(link);
        }
        const missingAnnotations = profileAnnotations.filter(a => !citedPages.has(`${a.site}|${a.book}|${a.page}`));

        for (const annotation of missingAnnotations) {
          const url = provider.buildUrlFromBookPage(annotation.book, annotation.page);
          const citation = { citation:`${annotation.info}, ${url}`, url: url, name: name, gender: pageData.mgender };
          missingCitations.push(citation);
        }
      }
      
    }

    recommendMissingCitations(missingCitations);
  }


  function recommendMissingCitations(missingCitations) {
    if (!missingCitations.length) return;

    const sourcesHeader =
      [...document.querySelectorAll("h2")]
        .find(h =>
          h.textContent.includes("Sources")
        );

    if (!sourcesHeader) return;  // do something else here

    const icon = document.createElement("img");

    icon.src = chrome.runtime.getURL("icons/icon32.png");

    if (missingCitations.length === 1) {
      icon.title =
        "1 citation suggestion available";
    } else {
      icon.title =
        `${missingCitations.length} citation suggestions available`;
    }

    Object.assign(icon.style, {
      width: "32px",
      height: "32px",
      marginLeft: "6px",
      cursor: "pointer",
      verticalAlign: "middle"
    });
  
    icon.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "OPEN_SUGGESTION_WINDOW",
        suggestions: missingCitations
      });
    });

    sourcesHeader.appendChild(icon);
  }

  function injectWtIdIntoCitationLink(link) {

      const url = new URL(link.href);

      url.searchParams.set("wtId", wtId);

      link.href = url.toString();
  }


  function addAnnotationMarker(link) {
    const icon = document.createElement("img");

    icon.src = chrome.runtime.getURL("icons/highlighter32.png");
    icon.alt = "Annotated source";
    icon.title = "Source is annotated";

    Object.assign(icon.style, {
      width: "24px",
      height: "24px",
      marginLeft: "4px",
      verticalAlign: "middle"
    });

    link.after(icon);
  }

  function getCurrentWtId() {
    const match = window.location.pathname.match(/\/wiki\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }


  processCitationLinks();
})();

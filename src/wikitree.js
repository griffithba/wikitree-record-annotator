const archiveProviders = [
  riksarkivetProvider
];

const wtId = getCurrentWtId();

async function processCitationLinks() {
  const annotations = await storage.getAnnotations();

  const profileAnnotations =
    annotations.filter(a => a.wtId === wtId);

  const annotatedPages = new Set(
    profileAnnotations.map(a => a.page)
  );

  const citedPages = new Set();

  archiveProviders.forEach(provider => {
    const links = [
      ...document.querySelectorAll(
        `a[href*="${provider.id}"]`
      )
    ];

    for (const link of links) {
      const key = provider.getPageKey(link.href);

      citedPages.add(key);

      if (annotatedPages.has(key)) {
        addAnnotationMarker(link);
      }

      injectWtIdIntoCitationLink(link);
    }
  });

  const missingAnnotations =
    profileAnnotations.filter(a =>
      !citedPages.has(a.page)
    );

  recommendMissingCitations(missingAnnotations);
}


function recommendMissingCitations(missingAnnotations) {
  if (!missingAnnotations.length) return;

  const sourcesHeader =
    [...document.querySelectorAll("h2")]
      .find(h =>
        h.textContent.includes("Sources")
      );

  if (!sourcesHeader) return;  // do something else here

  const icon = document.createElement("img");

  icon.src = chrome.runtime.getURL("icons/icon32.png");

  icon.title =
    `${missingAnnotations.length} citation suggestions available`;

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
      suggestions: missingAnnotations
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
  const icon = document.createElement("span");

  icon.textContent = "✎";
  icon.style.color = "limegreen";
  icon.style.fontSize = "1.0em";
  icon.title = "Source is annotated";


  link.after(icon);
}

function getCurrentWtId() {
  const match = window.location.pathname.match(/\/wiki\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

processCitationLinks();
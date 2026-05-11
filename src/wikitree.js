const archiveProviders = [
  riksarkivetProvider
];

const wtId = getCurrentWtId();

async function markCitations(){
  const annotations = await storage.getAnnotations();

  const annotatedPages = new Set(
    annotations
    .filter(a => a.wtId === wtId)
    .map(a => a.page)
  );

  archiveProviders.forEach(provider => {
    const links = 
      [...document.querySelectorAll(`a[href*="${provider.id}"]`)];

    for (const link of links) {
      const key = provider.getPageKey(link.href);

      if (annotatedPages.has(key)) {
        addAnnotationMarker(link);
      }

      injectWtIdIntoCitationLink(link);
    }
  });
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

markCitations();
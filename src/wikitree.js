const links = [...document.querySelectorAll('a[href*="riksarkivet"]')];

async function markCitations(){
  const wtId = getCurrentWtId();

  const annotations = await storage.getAnnotations();

  const annotatedPages = new Set(
    annotations
    .filter(a => a.wtId === wtId)
    .map(a => a.page)
  );

  for (const link of links) {
    const key = getPageKey(link.href);

    if (annotatedPages.has(key)) {
      addAnnotationMarker(link);
    }
  }
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


function injectWtIdsIntoCitationLinks() {
  const wtId = getCurrentWtId();
  if (!wtId) return;

  links.forEach(link => {
    const url = new URL(link.href);

    url.searchParams.set("wtId", wtId);

    link.href = url.toString();
  });
}

injectWtIdsIntoCitationLinks();
markCitations();
function getCurrentWtId() {
  const match = window.location.pathname.match(/\/wiki\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

document.addEventListener("mousedown", (e) => {
  console.log("Caught click");
  const link = e.target.closest("a");
  if (!link) return;
  console.log("Detected link");
  // Only modify links going to Riksarkivet (adjust domain as needed)
  if (link.href.includes("riksarkivet")) {
    const wtId = getCurrentWtId();
    if (!wtId) return;

    const url = new URL(link.href);
    url.searchParams.set("wtId", wtId);
  
    console.log("Injecting WT ID:", wtId, "→", url.toString());

    link.href = url.toString();
  }
});

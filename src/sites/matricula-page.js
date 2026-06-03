
/**
 * Defensive Scraper: Iterates through global scope structures to discover 
 * the unminified Matricula OpenLayers view state engine, even if the primary 
 * root variable name changes.
 */
function getViewInstance() {
  // 1. Happy Path: Check the known standard wrapper first
  if (window.dv1?.b?.view) {
    return window.dv1.b.view;
  }

  // 2. Dynamic Fallback Scraper: Deep search global object spaces
  // Only inspect top-level variables matching minified or application hashes
  const skipList = ["window", "document", "location", "top", "chrome", "Map", "Set"];
    
  for (const key in window) {
    if (skipList.includes(key) || key.startsWith("webpack") || key.startsWith("__")) continue;

    try {
      const rootObj = window[key];
      if (!rootObj || typeof rootObj !== "object") continue;

      // Matricula wraps the view controller deep inside their application controller object tree.
      // We traverse down possible nested objects to scan for the signature 'l' structure.
      for (const subKey in rootObj) {
        const subObj = rootObj[subKey];
        if (!subObj || typeof subObj !== "object") continue;

        // Check if this sub-object holds the 'view' structure
        const viewObj = subObj.view || subObj._view || subObj.mapView;
        if (viewObj && viewObj.l && "center" in viewObj.l && "resolution" in viewObj.l) {
          console.log(`🎯 Defensive Scraper successfully recovered hidden view module under parameter: window.${key}.${subKey}.view`);
          return viewObj;
        }
          
        // Direct double-check if the subObj itself is the view object
        if (subObj.l && "center" in subObj.l && "resolution" in subObj.l) {
           console.log(`🎯 Defensive Scraper successfully recovered hidden view module under parameter: window.${key}.${subKey}`);
           return subObj;
        }
      }
    } catch (e) {
      // Suppress cross-origin security context access block exceptions cleanly
    }
  }

  return null;
}


function attach(view) {

    const sendState = () => {
        window.postMessage({
            type: "MATRICULA_VIEW_CHANGED",
            state: view.l
        }, "*");
    };

    view.addEventListener("change", sendState);

    // Initial send to capture the state on load
    sendState();
}

const timer = setInterval(() => {
    const view = getViewInstance();

    if (!view) return;

    clearInterval(timer);
    attach(view);

}, 500);
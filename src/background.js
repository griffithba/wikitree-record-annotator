// background.js (MV3 service worker)

const enrichmentInProgress = new Map();

// ============================================================
// CONFIGURATION
// ============================================================


/**
 * Handles messages from content scripts (RA + WT pages)
 * and performs WikiTree enrichment operations.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We may respond asynchronously
  if (message?.type === "FETCH_PERSON") {
    handleEnrichment(message.wtId)
      .then(sendResponse)
      .catch(err => {
        console.error("WT API fetch failed:", err);
        sendResponse({ error: true });
      });

    return true; // IMPORTANT: keeps message channel open
  }

  if (message?.type === "OPEN_SUGGESTION_WINDOW") {

    currentSuggestions = message.suggestions || [];

    chrome.windows.create({
      url: chrome.runtime.getURL("src/suggestions.html"),
      type: "popup",
      width: 450,
      height: 700
    });

    return;
  }

  if (message?.type === "GET_SUGGESTIONS") {
    sendResponse(currentSuggestions);
    return;
  }

});


async function handleEnrichment(wtId) {
  if (enrichmentInProgress.has(wtId)) {
    return enrichmentInProgress.get(wtId);
  }

  const promise = (async () => {
    try {
      const profile = await fetchWikiTreeProfile(wtId);

      if (!profile) {
        return {
          status: "invalid",
          wtId
        };
      }

      return {
        wtId,
        status: "verified",
        name: profile.name || null,
        birth: profile.birthYear || null,
        death: profile.deathYear || null
      };
  } finally {
      enrichmentInProgress.delete(wtId);
    }
  })();
  
  enrichmentInProgress.set(wtId, promise);
  return promise;
}

async function fetchWikiTreeProfile(wtId) {
  try {
    const form = new URLSearchParams();
    form.append("action", "getPerson");
    form.append("key", wtId);
    form.append("fields", "FirstName,LastNameAtBirth,BirthDate,DeathDate");
    form.append("appId", "wikitree-ref-overlays");

    console.log("Fetching WT profile:", wtId);
    const res = await fetch("https://api.wikitree.com/api.php", {
      method: "POST",
      body: form
    });
    console.log("WT response status:", res.status);
    
    const data = await res.json();

    const person = data?.[0]?.person;
    if (!person) return null;

    return {
      name: buildDisplayName(person) || null,
      birthYear: extractYear(person.BirthDate),
      deathYear: extractYear(person.DeathDate)
    };
  } catch (e) {
    console.error("WT fetch error:", e);
    return null;
  }
}


function buildDisplayName(person) {
  const first = person.FirstName || "";

  const last = person.LastNameAtBirth || "";

  return `${first} ${last}`.trim();
}


function extractYear(dateStr) {
  if (!dateStr) return null;

  const match = dateStr.match(/\d{4}/);
  if (!match) return null;

  const year = match[0];

  return year === "0000" ? null : year;
}

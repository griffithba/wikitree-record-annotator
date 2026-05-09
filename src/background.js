// background.js (MV3 service worker)

// ============================================================
// CONFIGURATION
// ============================================================

// Cache expiration time (in milliseconds)
// Set to 14 days: 14 * 24 * 60 * 60 * 1000
const PERSON_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Handles messages from content scripts (RA + WT pages)
 * and performs WikiTree enrichment operations.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We may respond asynchronously
  if (message?.type === "ENRICH_ANNOTATION") {
    handleEnrichment(message.annotation)
      .then(sendResponse)
      .catch(err => {
        console.error("Enrichment failed:", err);
        sendResponse({ error: true });
      });

    return true; // IMPORTANT: keeps message channel open
  }
});


async function handleEnrichment(annotation) {
  const wtId = annotation?.wtId;
  if (!wtId) {
    return { status: "invalid", reason: "missing_wt_id" };
  }

  // Check cache first
  const cached = await getCachedPerson(wtId);
  if (cached) {
    console.log("Using cached person data for:", wtId);
    return cached;
  }

  // Not in cache or expired, fetch fresh
  const profile = await fetchWikiTreeProfile(wtId);

  if (!profile) {
    // Cache the failure so we don't keep retrying
    const invalid = {
      status: "invalid",
      wtId
    };
    await saveCachedPerson(wtId, invalid);
    return invalid;
  }

  const result = {
    wtId,
    status: "verified",
    name: profile.name || null,
    birth: profile.birthYear || null,
    death: profile.deathYear || null
  };

  // Cache the success
  await saveCachedPerson(wtId, result);
  return result;
}

/**
 * Retrieves cached person data if it exists and is not expired
 * @param {string} wtId - WikiTree ID
 * @returns {Object|null} Cached person data or null if not found/expired
 */
async function getCachedPerson(wtId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["wt-people"], (result) => {
      const people = result["wt-people"] || {};
      const cached = people[wtId];

      if (!cached) {
        resolve(null);
        return;
      }

      // Check if cache has expired
      if (cached.cachedAt) {
        const age = Date.now() - cached.cachedAt;
        if (age > PERSON_CACHE_MAX_AGE_MS) {
          console.log("Cache expired for:", wtId);
          resolve(null);
          return;
        }
      }

      resolve(cached);
    });
  });
}

/**
 * Saves person data to cache with timestamp
 * @param {string} wtId - WikiTree ID
 * @param {Object} data - Person data to cache
 */
async function saveCachedPerson(wtId, data) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["wt-people"], (result) => {
      const people = result["wt-people"] || {};
      
      // Add timestamp to cached data
      people[wtId] = {
        ...data,
        cachedAt: Date.now()
      };

      chrome.storage.local.set({ "wt-people": people }, resolve);
    });
  });
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

// background.js (MV3 service worker)
import * as wikitreeAPI from "./background/wikitree.js";


let currentSuggestions = [];

/**
 * Handles messages from content scripts (RA + WT pages)
 * and performs WikiTree fetch operations.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case "FETCH_PERSON":
      wikitreeAPI.handleWtFetch(message.wtId)
        .then(sendResponse)
        .catch(err => {
          console.error("WT API fetch failed:", err);
          sendResponse({ error: true });
        });

      return true; // IMPORTANT: keeps message channel open
  

    case "OPEN_SUGGESTION_WINDOW":

      currentSuggestions = message.suggestions || [];

      chrome.windows.create({
        url: chrome.runtime.getURL("src/suggestions.html"),
        type: "popup",
        width: 450,
        height: 700
      });

      return;
  

    case "GET_SUGGESTIONS":
      sendResponse(currentSuggestions);
      return;
  }

});


// background.js (MV3 service worker)
import * as wikitreeAPI from "./background/wikitree.js";
import * as wtplusAPI from "./background/wtplus.js";

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
  

    case "GET_FRAMES_FOR_PAGE":
      wtplusAPI.getFramesByPage(message.site, message.book, message.page)
        .then(sendResponse)
        .catch(err => {
          console.error("WT+ wtImageFramesGet for page failed:", err);
          sendResponse({ error: true });
        });

      return true;

      
    case "GET_FRAMES_FOR_PROFILE":
      wtplusAPI.getFramesByWtId(message.site, message.wtId)
        .then(sendResponse)
        .catch(err => {
          console.error("WT+ wtImageFramesGet for profile failed:", err);
          sendResponse({ error: true });
        });

      return true;

      
    case "ADD_FRAME":
      wtplusAPI.addFrame(
        message.site, message.book, message.page, message.info, message.wikitreeid, message.frame)
        .then(sendResponse)
        .catch(err => {
          console.error("WT+ addFrame failed:", err);
          sendResponse({ error: true });
        });

      return true;

      
    case "DELETE_FRAME":
      wtplusAPI.deleteFrame(
        message.site, message.book, message.page, message.wikitreeid, message.frameId)
        .then(sendResponse)
        .catch(err => {
          console.error("WT+ deleteFrame failed:", err);
          sendResponse({ error: true });
        });

      return true;

      
    case "OPEN_SUGGESTION_WINDOW":

      currentSuggestions = message.suggestions || [];

      chrome.windows.create({
        url: chrome.runtime.getURL("src/background/suggestions.html"),
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


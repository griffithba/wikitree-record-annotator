chrome.runtime.sendMessage(
  { type: "GET_SUGGESTIONS" },
  suggestions => {
    console.log(suggestions);
  }
);
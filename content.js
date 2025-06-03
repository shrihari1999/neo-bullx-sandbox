chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TITLE") {
    sendResponse({ title: document.title });
  }
});

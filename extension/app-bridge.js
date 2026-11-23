// Працює на сторінці програми: передає повідомлення від розширення програмі через window.postMessage.
chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  var ext = globalThis.ForWorshipExt;
  if (!msg || msg.type !== ext.MESSAGE_TYPE || msg.version !== ext.VERSION) return;
  window.postMessage(msg, location.origin);
  sendResponse({ ok: true });
});

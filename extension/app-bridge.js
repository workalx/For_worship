// Працює на сторінці програми: передає імпорт програмі через window.postMessage і чекає на її результат.
var REPOST_MS = 700;
var TIMEOUT_MS = 15000;

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  var ext = globalThis.ForWorshipExt;
  if (!msg || msg.type !== ext.MESSAGE_TYPE || msg.version !== ext.VERSION) return;

  var finished = false;
  var repostTimer = null;
  var timeoutTimer = null;

  function finish(reply) {
    if (finished) return;
    finished = true;
    clearInterval(repostTimer);
    clearTimeout(timeoutTimer);
    window.removeEventListener('message', onResult);
    sendResponse(reply);
  }

  function onResult(event) {
    if (event.origin !== location.origin || !ext.isResultMessage(event.data)) return;
    finish({ ok: event.data.ok, error: event.data.error });
  }

  window.addEventListener('message', onResult);
  window.postMessage(msg, location.origin);
  // Слухач програми може ще не змонтуватись; повторний імпорт безпечний (оновлення за номером CCLI).
  repostTimer = setInterval(function () {
    window.postMessage(msg, location.origin);
  }, REPOST_MS);
  timeoutTimer = setTimeout(function () {
    finish({ ok: false, error: 'timeout' });
  }, TIMEOUT_MS);
  return true; // відповідь асинхронна
});

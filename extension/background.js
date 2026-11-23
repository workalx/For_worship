importScripts('lib.js');

var ext = globalThis.ForWorshipExt;
var RETRIES = 10;
var RETRY_DELAY_MS = 300;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function findAppTab() {
  return chrome.tabs
    .query({ url: ext.APP_ORIGINS.map(function (o) { return o + '/*'; }) })
    .then(function (tabs) {
      return tabs[0] || null;
    });
}

function waitForComplete(tabId) {
  return new Promise(function (resolve) {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') finish();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then(function (t) {
      if (t.status === 'complete') finish();
    });
    setTimeout(finish, 30000);
  });
}

async function deliver(msg) {
  var tab = await findAppTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: ext.APP_ORIGINS[0] + '/', active: true });
    await waitForComplete(tab.id);
  }
  // Слухач програми з'являється після рендеру React — пробуємо кілька разів.
  var lastError = 'Не вдалося зв\u2019язатися з програмою';
  for (var i = 0; i < RETRIES; i++) {
    try {
      var res = await chrome.tabs.sendMessage(tab.id, msg);
      if (res && res.ok) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
        return { ok: true };
      }
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
    }
    await sleep(RETRY_DELAY_MS);
  }
  return { ok: false, error: lastError };
}

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (!msg || msg.type !== ext.MESSAGE_TYPE) return;
  deliver(msg).then(sendResponse, function (e) {
    sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
  });
  return true; // відповідь асинхронна
});

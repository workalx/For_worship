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
    chrome.tabs
      .get(tabId)
      .then(function (t) {
        if (t.status === 'complete') finish();
      })
      .catch(finish); // вкладку закрито
    setTimeout(finish, 30000);
  });
}

async function trySend(tabId, msg) {
  var lastError = 'Не вдалося зв’язатися з програмою';
  for (var i = 0; i < RETRIES; i++) {
    try {
      var res = await chrome.tabs.sendMessage(tabId, msg);
      // Будь-яка відповідь моста (успіх, помилка імпорту, timeout) остаточна.
      if (res && res.ok) return { ok: true };
      return { ok: false, error: (res && res.error) || lastError };
    } catch (e) {
      // Немає отримувача (content script ще не завантажено) — короткі повтори.
      lastError = e && e.message ? e.message : String(e);
    }
    await sleep(RETRY_DELAY_MS);
  }
  return { ok: false, error: lastError, noReceiver: true };
}

async function deliver(msg) {
  var tab = await findAppTab();
  var existing = !!tab;
  if (!tab) {
    tab = await chrome.tabs.create({ url: ext.APP_ORIGINS[0] + '/', active: true });
    await waitForComplete(tab.id);
  }
  var result = await trySend(tab.id, msg);
  if (!result.ok && result.noReceiver && existing) {
    // Вкладка, відкрита до встановлення розширення, не має content script — перезавантажуємо й пробуємо ще раз.
    await chrome.tabs.reload(tab.id);
    await waitForComplete(tab.id);
    result = await trySend(tab.id, msg);
  }
  if (result.ok) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  }
  return result;
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== ext.MESSAGE_TYPE || msg.version !== ext.VERSION) return;
  if (!sender || typeof sender.url !== 'string' || sender.url.indexOf('https://songselect.ccli.com/') !== 0) return;
  deliver(msg).then(sendResponse, function (e) {
    sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
  });
  return true; // відповідь асинхронна
});

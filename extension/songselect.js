// Працює на songselect.ccli.com: додає кнопку «Додати в For Worship» на сторінці акордів.
(function () {
  var ext = globalThis.ForWorshipExt;
  var BUTTON_ID = 'for-worship-add-button';
  var TOOLBAR_BUTTON_ID = 'chordSheetPrintButton';
  var LABEL = 'Додати в For Worship';

  function currentKey() {
    var rendered = document.querySelector('code.cproSongKey[data-chordname]');
    var name = rendered && rendered.getAttribute('data-chordname');
    if (name) return name;
    var input = document.getElementById('ChordSheetTransposeKeySelectInput');
    if (input && (input.tagName === 'SELECT' || input.tagName === 'INPUT') && input.value) return input.value;
    return null;
  }

  function setState(btn, text, resetMs) {
    btn.textContent = text;
    btn.disabled = text === 'Додаю…';
    if (resetMs) {
      setTimeout(function () {
        btn.textContent = LABEL;
        btn.disabled = false;
      }, resetMs);
    }
  }

  async function onClick(btn) {
    var number = ext.songNumberFromUrl(location.href);
    var key = currentKey();
    if (!number || !key) {
      setState(btn, 'Помилка', 3000);
      return;
    }
    setState(btn, 'Додаю…');
    try {
      var res = await fetch(ext.chordsHtmlUrl(number, key), { credentials: 'include' });
      var data = await res.json();
      if (!data || data.isSuccess !== true || typeof data.payload !== 'string' || !data.payload) {
        throw new Error('empty');
      }
      var reply = await chrome.runtime.sendMessage(ext.buildImportMessage(data.payload, location.href, number));
      if (reply && reply.ok) setState(btn, 'Додано ✓', 3000);
      else setState(btn, 'Помилка', 3000);
    } catch (e) {
      setState(btn, 'Помилка', 3000);
    }
  }

  function makeButton(floating) {
    var btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = LABEL;
    btn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;padding:8px 14px;font:600 14px sans-serif;' +
      'background:#e8a33d;color:#111;margin-left:8px;' +
      (floating ? 'position:fixed;right:16px;bottom:16px;z-index:2147483647;box-shadow:0 2px 8px rgba(0,0,0,.4);' : '');
    btn.addEventListener('click', function () {
      onClick(btn);
    });
    return btn;
  }

  function sync() {
    var existing = document.getElementById(BUTTON_ID);
    if (!ext.isChordSheetUrl(location.href)) {
      if (existing) existing.remove();
      return;
    }
    var anchor = document.getElementById(TOOLBAR_BUTTON_ID);
    var toolbar = anchor && anchor.parentElement;
    if (existing) {
      // Кнопка вже на місці. Плаваючу переносимо в панель, щойно та з'явиться.
      if (!toolbar || existing.parentElement === toolbar) return;
      existing.remove();
    }
    if (toolbar) toolbar.appendChild(makeButton(false));
    else if (document.body) document.body.appendChild(makeButton(true));
  }

  // SPA: адреса змінюється без перезавантаження, а панель може з'явитися пізніше — стежимо за DOM.
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      sync();
    }, 100);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();

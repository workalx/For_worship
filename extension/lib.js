// Спільні чисті функції розширення. Класичний скрипт: визначає globalThis.ForWorshipExt.
(function () {
  var MESSAGE_TYPE = 'for-worship/songselect-import';
  var VERSION = 1;
  // Адреси програми. Додайте свою публікацію сюди та в manifest.json (див. README.md).
  var APP_ORIGINS = ['http://localhost:5173'];

  function parse(url) {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }

  function songNumberFromUrl(url) {
    var u = parse(url);
    if (!u) return null;
    var m = /^\/songs\/(\d+)(?:\/|$)/.exec(u.pathname);
    return m ? m[1] : null;
  }

  function isChordSheetUrl(url) {
    var u = parse(url);
    if (!u) return false;
    return songNumberFromUrl(url) !== null && /\/viewchordsheet\/?$/i.test(u.pathname);
  }

  function chordsHtmlUrl(songNumber, key) {
    return (
      '/api/GetSongChordsHTML?songNumber=' +
      encodeURIComponent(songNumber) +
      '&key=' +
      encodeURIComponent(key) +
      '&style=Standard&columns=1&enableFontCustomization=0'
    );
  }

  function buildImportMessage(html, pageUrl, ccliNumber) {
    return { type: MESSAGE_TYPE, version: VERSION, html: html, pageUrl: pageUrl, ccliNumber: ccliNumber };
  }

  globalThis.ForWorshipExt = {
    MESSAGE_TYPE: MESSAGE_TYPE,
    VERSION: VERSION,
    APP_ORIGINS: APP_ORIGINS,
    songNumberFromUrl: songNumberFromUrl,
    isChordSheetUrl: isChordSheetUrl,
    chordsHtmlUrl: chordsHtmlUrl,
    buildImportMessage: buildImportMessage,
  };
})();

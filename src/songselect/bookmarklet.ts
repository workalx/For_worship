/**
 * Букмарклет «Додати в For Worship» для планшетів, де Chrome-розширення не працюють.
 *
 * Запускається на сторінці акордів SongSelect (вкладка Chord Sheet), бере аркуш у вибраній тональності
 * тим самим запитом, що й розширення, стискає його й переходить у програму з даними в хеші адреси
 * (`#songselect=…`). Хеш не надсилається на сервер; програма читає його при запуску (див. hashImport.ts).
 *
 * Код навмисно на ES5 + Promise: його виконує браузер планшета як є, без збирання.
 */
const BODY = `(function(){
var APP=__APP__;
var path=location.pathname;
var m=/^\\/songs\\/(\\d+)(?:\\/|$)/.exec(path);
if(location.hostname!=='songselect.ccli.com'||!m||!/\\/viewchordsheet\\/?$/i.test(path)){
alert('For Worship: відкрийте пісню на songselect.ccli.com, вкладку Chord Sheet, і запустіть закладку ще раз.');return;}
var el=document.querySelector('code.cproSongKey[data-chordname]');
var key=el&&el.getAttribute('data-chordname');
if(!key){var inp=document.getElementById('ChordSheetTransposeKeySelectInput');key=inp&&inp.value;}
if(!key){alert('For Worship: не вдалося визначити тональність на сторінці.');return;}
function b64(u){var s='';for(var i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}
function pack(text){var bytes=new TextEncoder().encode(text);
if(typeof CompressionStream==='undefined')return Promise.resolve('r'+b64(bytes));
return new Response(new Response(bytes).body.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
.then(function(b){return 'z'+b64(new Uint8Array(b));});}
fetch('/api/GetSongChordsHTML?songNumber='+encodeURIComponent(m[1])+'&key='+encodeURIComponent(key)+'&style=Standard&columns=1&enableFontCustomization=0',{credentials:'include'})
.then(function(r){return r.json();})
.then(function(d){if(!d||d.isSuccess!==true||typeof d.payload!=='string'||!d.payload)throw new Error('empty');
return pack(JSON.stringify({html:d.payload,pageUrl:location.href,ccliNumber:m[1]}));})
.then(function(p){location.href=APP+'#songselect='+p;})
.catch(function(){alert('For Worship: не вдалося отримати акорди. Перевірте, що ви увійшли в SongSelect.');});
})();`;

/** Сирий код букмарклета (без префікса javascript:) для адреси програми `appUrl`. */
export function bookmarkletSource(appUrl: string): string {
  return BODY.replace('__APP__', JSON.stringify(appUrl));
}

/** Готова адреса закладки. Весь код закодовано: браузери декодують %-послідовності в javascript:-адресах. */
export function bookmarkletHref(appUrl: string): string {
  return 'javascript:' + encodeURIComponent(bookmarkletSource(appUrl));
}

/** Адреса програми без хешу й параметрів — сюди букмарклет повертає пісню. */
export function currentAppUrl(loc: Location = window.location): string {
  return loc.origin + loc.pathname;
}

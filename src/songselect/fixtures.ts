/** Вигадана фікстура у структурі аркуша акордів SongSelect (GetSongChordsHTML). Текст не з реальних пісень. */
const chord = (name: string, shown: string, lyrics: string) =>
  `<span class="chordWrapper"><code class="chord" data-chordname="${name}">${shown}</code><span class="chordLyrics">${lyrics}</span></span>`;

export const SONGSELECT_SAMPLE_HTML: string =
  `<span class="cproSongHeader"><span class="cproTitleLine"><span class="cproTitle">Тестова пісня</span><img class="cproSSLogo"></span>` +
  `<span class="cproAuthorLine"><span class="cproAuthors">Автор Один, Автор Два</span></span>` +
  `<span class="cproAuthor2Line"><span class="cproAuthor2">(вигадана примітка)</span></span>` +
  `<div class="cproKeyTempoTimeLine"><span class="cproSongKeyWrapper">Key - <code class="cproSongKey" data-chordname="G">G</code> | </span>` +
  `<span class="cproTempoTimeWrapper">Tempo - 72 | Time - 4/4</span></div></span><br>\n` +
  `<pre class="cproSongBody"><span class="cproSongSection"><span class="cproComment">Verse 1</span>\n` +
  `<span class="cproSongLine">Ми ${chord('G', 'G', 'спі')}ваємо тут </span>\n` +
  `<span class="cproSongLine">Світло ${chord('D/F#', 'D/F#', 'т')}епле ${chord('Em7', 'Em<sup>7</sup>', 'в')}дома ${chord('Cadd9', 'Cadd9', ' ')}</span>\n` +
  `<span class="cproSongLine">Далі <span class="cproDirectionWrapper"><span class="cproDirection">(To Chorus)</span><span class="chordLyrics"> </span></span></span>\n` +
  `</span>\n` +
  `<span class="cproSongSection"><span class="cproComment">Chorus</span>\n` +
  `<span class="cproSongLine">${chord('G', 'G', 'Сла')}ва ${chord('D/F#', 'D/F#', 'на')}м </span>\n` +
  `</span></pre>\n` +
  `<div class="copyright-info"><p class="songnumber">CCLI Song # 1234567</p><ul class="copyright"><li>© 2020 Test Music</li><li>Test Publishing</li></ul>` +
  `<p class="disclaimer">For use solely with the SongSelect® <a>Terms of Use</a>. All rights reserved. <a>www.ccli.com</a></p>` +
  `<p class="licenseno">CCLI License # 99999999</p></div>`;

import { useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { db, requestPersistentStorage, type Song } from './db/db';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LibraryScreen } from './library/LibraryScreen';
import type { Shared } from './library/shareTarget';
import { MetronomeScreen } from './metronome/MetronomeScreen';
import { useMetronome } from './metronome/useMetronome';
import { ServicePlayer } from './service/ServicePlayer';
import { ServiceScreen } from './service/ServiceScreen';
import { TunerScreen } from './tuner/TunerScreen';
import { listenForSongSelect } from './songselect/bridge';
import { decodeSongSelectHash } from './songselect/hashImport';
import { importSongSelect, type SongSelectImport } from './songselect/importSong';
import './styles/theme.css';

export default function App({ shared, songSelectHash }: { shared?: Shared | null; songSelectHash?: string | null }) {
  const [tab, setTab] = useState<Tab>('songs');
  const [playing, setPlaying] = useState<{ serviceId: string; index: number } | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const metro = useMetronome();
  // Поширений вміст показуємо один раз: після повернення на вкладку «Пісні» він не має відкриватися знову.
  const pendingShared = useRef(shared ?? null);

  const [openSong, setOpenSong] = useState<{ id: string; nonce: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const onSongSelectImported = (song: Song) => {
    setTab('songs');
    setOpenSong((p) => ({ id: song.id, nonce: (p?.nonce ?? 0) + 1 }));
    setToast(`Додано з SongSelect: ${song.title}`);
  };
  const onSongSelectError = () => setToast('SongSelect: не вдалося додати пісню');

  // Пісні зі SongSelect приходять від розширення браузера через window.postMessage.
  useEffect(() => listenForSongSelect(onSongSelectImported, onSongSelectError), []);

  // …або від букмарклета (планшети) у хеші адреси. Таку адресу може відкрити будь-яке посилання,
  // тож заміну наявної пісні з тим самим номером CCLI підтверджує користувач.
  const [hashImport, setHashImport] = useState<SongSelectImport | null>(null);
  const hashHandled = useRef(false);
  const runHashImport = (msg: SongSelectImport) =>
    importSongSelect(msg).then(onSongSelectImported, onSongSelectError);
  useEffect(() => {
    if (!songSelectHash || hashHandled.current) return;
    hashHandled.current = true;
    void (async () => {
      const msg = await decodeSongSelectHash(songSelectHash);
      if (!msg) return onSongSelectError();
      const existing = await db.songs.filter((s) => s.ccliNumber === msg.ccliNumber).first();
      if (existing) setHashImport(msg);
      else await runHashImport(msg);
    })();
  }, [songSelectHash]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const play = (serviceId: string, index: number) => {
    setPlaying({ serviceId, index });
    setTab('service');
  };

  let screen;
  if (tab === 'songs') {
    screen = (
      <LibraryScreen
        onPlay={play}
        onSongShown={setCurrentSong}
        shared={pendingShared.current}
        openSongId={openSong?.id}
        openSongNonce={openSong?.nonce}
        onOpenedSong={() => setOpenSong(null)}
      />
    );
  } else if (tab === 'service') {
    screen = playing ? (
      <ServicePlayer
        serviceId={playing.serviceId}
        index={playing.index}
        onExit={() => setPlaying(null)}
        onSongShown={setCurrentSong}
        onIndexChange={(index) => setPlaying((p) => (p ? { ...p, index } : p))}
      />
    ) : (
      <ServiceScreen onPlay={(serviceId, index) => setPlaying({ serviceId, index })} />
    );
  } else if (tab === 'tuner') {
    screen = <TunerScreen />;
  } else {
    screen = (
      <MetronomeScreen
        metro={metro}
        songBpm={currentSong?.bpm}
        songTitle={currentSong?.title}
        songTimeSig={currentSong?.timeSig}
      />
    );
  }

  return (
    <div className="app">
      <main className="app-main">{screen}</main>
      {toast && <div className="toast">{toast}</div>}
      {hashImport && (
        <ConfirmDialog
          message="Пісня з цим номером CCLI вже є в бібліотеці. Оновити її даними зі SongSelect?"
          confirmLabel="Оновити"
          onConfirm={() => {
            const msg = hashImport;
            setHashImport(null);
            void runHashImport(msg);
          }}
          onCancel={() => setHashImport(null)}
        />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

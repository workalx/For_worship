import { useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { requestPersistentStorage, type Song } from './db/db';
import { LibraryScreen } from './library/LibraryScreen';
import type { Shared } from './library/shareTarget';
import { MetronomeScreen } from './metronome/MetronomeScreen';
import { useMetronome } from './metronome/useMetronome';
import { ServicePlayer } from './service/ServicePlayer';
import { ServiceScreen } from './service/ServiceScreen';
import { TunerScreen } from './tuner/TunerScreen';
import './styles/theme.css';

export default function App({ shared }: { shared?: Shared | null }) {
  const [tab, setTab] = useState<Tab>('songs');
  const [playing, setPlaying] = useState<{ serviceId: string; index: number } | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const metro = useMetronome();
  // Поширений вміст показуємо один раз: після повернення на вкладку «Пісні» він не має відкриватися знову.
  const pendingShared = useRef(shared ?? null);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const play = (serviceId: string, index: number) => {
    setPlaying({ serviceId, index });
    setTab('service');
  };

  let screen;
  if (tab === 'songs') {
    screen = <LibraryScreen onPlay={play} onSongShown={setCurrentSong} shared={pendingShared.current} />;
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
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

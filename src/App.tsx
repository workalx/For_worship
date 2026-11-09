import { useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { ServiceScreen } from './service/ServiceScreen';
import { ServicePlayer } from './service/ServicePlayer';
import './styles/theme.css';

const TITLES: Record<Tab, string> = {
  songs: 'Пісні',
  service: 'Служіння',
  tuner: 'Тюнер',
  metronome: 'Метроном',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('songs');
  const [playing, setPlaying] = useState<{ serviceId: string; index: number } | null>(null);

  let screen;
  if (tab === 'service') {
    screen = playing ? (
      <ServicePlayer serviceId={playing.serviceId} index={playing.index} onExit={() => setPlaying(null)} />
    ) : (
      <ServiceScreen onPlay={(serviceId, index) => setPlaying({ serviceId, index })} />
    );
  } else {
    screen = <div className="placeholder-screen">{TITLES[tab]}</div>;
  }

  return (
    <div className="app">
      <main className="app-main">{screen}</main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

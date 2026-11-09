import { useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import './styles/theme.css';

const TITLES: Record<Tab, string> = {
  songs: 'Пісні',
  service: 'Служіння',
  tuner: 'Тюнер',
  metronome: 'Метроном',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('songs');
  return (
    <div className="app">
      <main className="app-main">
        <div className="placeholder-screen">{TITLES[tab]}</div>
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

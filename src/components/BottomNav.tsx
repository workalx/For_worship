import './BottomNav.css';
import { Icon } from './Icon';
import { Guitar, ListMusic, Metronome, Music, type LucideIcon } from 'lucide-react';

export type Tab = 'songs' | 'service' | 'tuner' | 'metronome';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'songs', label: 'Пісні', icon: Music },
  { id: 'service', label: 'Служіння', icon: ListMusic },
  { id: 'tuner', label: 'Тюнер', icon: Guitar },
  { id: 'metronome', label: 'Метроном', icon: Metronome },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === active ? 'on' : undefined}
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <Icon as={t.icon} size={20} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

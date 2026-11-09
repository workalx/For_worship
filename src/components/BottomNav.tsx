import './BottomNav.css';

export type Tab = 'songs' | 'service' | 'tuner' | 'metronome';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'songs', label: 'Пісні', icon: '♫' },
  { id: 'service', label: 'Служіння', icon: '☰' },
  { id: 'tuner', label: 'Тюнер', icon: '◎' },
  { id: 'metronome', label: 'Метроном', icon: '◷' },
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
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

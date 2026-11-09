import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MetronomeScreen } from './MetronomeScreen';
import type { Metronome } from './useMetronome';
import type { TimeSig } from '../db/db';

const toggle = vi.fn();

function Harness(props: { songBpm?: number; songTitle?: string; songTimeSig?: TimeSig }) {
  const [bpm, setBpm] = useState(120);
  const [timeSig, setTimeSig] = useState<TimeSig>('4/4');
  const metro: Metronome = { bpm, setBpm, timeSig, setTimeSig, running: false, toggle, beat: -1 };
  return <MetronomeScreen metro={metro} {...props} />;
}

test('кнопки ±1 змінюють темп у межах 30–250', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '+1' }));
  expect(screen.getByTestId('bpm')).toHaveTextContent('121');
  await userEvent.click(screen.getByRole('button', { name: '−1' }));
  await userEvent.click(screen.getByRole('button', { name: '−1' }));
  expect(screen.getByTestId('bpm')).toHaveTextContent('119');
});

test('розмір 3/4 дає три кружечки-долі', async () => {
  render(<Harness />);
  expect(screen.getAllByTestId('beat-dot')).toHaveLength(4);
  await userEvent.selectOptions(screen.getByLabelText('Розмір'), '3/4');
  expect(screen.getAllByTestId('beat-dot')).toHaveLength(3);
});

test('«З пісні» бере темп і розмір поточної пісні', async () => {
  render(<Harness songBpm={72} songTitle="Світло в темряві" songTimeSig="6/8" />);
  await userEvent.click(screen.getByRole('button', { name: /З пісні: Світло в темряві · 72/ }));
  expect(screen.getByTestId('bpm')).toHaveTextContent('72');
  expect(screen.getAllByTestId('beat-dot')).toHaveLength(6);
});

test('без пісні кнопки «З пісні» немає', () => {
  render(<Harness />);
  expect(screen.queryByRole('button', { name: /З пісні/ })).not.toBeInTheDocument();
});

test('кнопка ▶ запускає метроном', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Старт' }));
  expect(toggle).toHaveBeenCalled();
});

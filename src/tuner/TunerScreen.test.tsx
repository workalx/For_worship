import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TunerScreen } from './TunerScreen';

const state = { start: vi.fn(async () => {}), stop: vi.fn(), freq: null as number | null, error: null as string | null, running: false };
vi.mock('./useTuner', () => ({ useTuner: () => state }));

beforeEach(() => {
  Object.assign(state, { freq: null, error: null, running: false });
  state.start.mockClear();
});

test('до увімкнення — кнопка мікрофона', async () => {
  render(<TunerScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Увімкнути мікрофон' }));
  expect(state.start).toHaveBeenCalled();
});

test('у тиші показує «—» і підказку', () => {
  state.running = true;
  render(<TunerScreen />);
  expect(screen.getByTestId('note')).toHaveTextContent('—');
  expect(screen.getByText('Зіграйте струну')).toBeInTheDocument();
});

test('майже точна нота A2 — зелена, струна A підсвічена', () => {
  state.running = true;
  state.freq = 110.3;
  render(<TunerScreen />);
  const note = screen.getByTestId('note');
  expect(note).toHaveTextContent('A');
  expect(note).toHaveClass('in-tune');
  expect(screen.getByLabelText('Струна 5: A')).toHaveClass('on');
});

test('розстроєна нота — не зелена, видно центи', () => {
  state.running = true;
  state.freq = 107;
  render(<TunerScreen />);
  expect(screen.getByTestId('note')).not.toHaveClass('in-tune');
  expect(screen.getByText(/−\d+ цент/)).toBeInTheDocument();
});

test('помилка мікрофона показується', () => {
  state.error = 'Дозвольте доступ до мікрофона в налаштуваннях браузера';
  render(<TunerScreen />);
  expect(screen.getByText(state.error)).toBeInTheDocument();
});

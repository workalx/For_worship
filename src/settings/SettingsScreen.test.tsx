import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen';
import { loadSettings } from './settings';

beforeEach(() => localStorage.clear());

test('зберігає ключ Gemini', async () => {
  render(<SettingsScreen onClose={() => {}} />);
  await userEvent.type(screen.getByLabelText('Ключ Gemini'), 'AIza-test');
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(loadSettings().geminiKey).toBe('AIza-test');
  expect(screen.getByText('Збережено')).toBeInTheDocument();
});

test('ключ прихований, доки не натиснути «Показати»', async () => {
  render(<SettingsScreen onClose={() => {}} />);
  const input = screen.getByLabelText('Ключ Gemini');
  expect(input).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getByRole('button', { name: 'Показати' }));
  expect(input).toHaveAttribute('type', 'text');
});

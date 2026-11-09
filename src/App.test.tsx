import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('показує 4 вкладки', () => {
  render(<App />);
  for (const name of ['Пісні', 'Служіння', 'Тюнер', 'Метроном']) {
    expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
  }
});

test('перемикає вкладку', async () => {
  render(<App />);
  const tuner = screen.getByRole('button', { name: /Тюнер/ });
  expect(tuner).not.toHaveAttribute('aria-current');
  await userEvent.click(tuner);
  expect(tuner).toHaveAttribute('aria-current', 'page');
});

test('вкладка «Служіння» показує список служінь', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /Служіння/ }));
  expect(await screen.findByRole('button', { name: '+ Нове служіння' })).toBeInTheDocument();
});

test('вкладка «Пісні» відкривається першою і показує бібліотеку', async () => {
  render(<App />);
  expect(await screen.findByRole('button', { name: '+ Нова пісня' })).toBeInTheDocument();
});

test('вкладка «Тюнер» показує тюнер', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /Тюнер/ }));
  expect(screen.getByRole('button', { name: 'Увімкнути мікрофон' })).toBeInTheDocument();
});

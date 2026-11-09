import { act, renderHook } from '@testing-library/react';
import { useTuner } from './useTuner';

test('відмова в мікрофоні дає зрозуміле повідомлення', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) },
  });
  const { result } = renderHook(() => useTuner());
  await act(async () => {
    await result.current.start();
  });
  expect(result.current.error).toBe('Дозвольте доступ до мікрофона в налаштуваннях браузера');
  expect(result.current.freq).toBeNull();
});

test('без підтримки мікрофона — теж повідомлення', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  const { result } = renderHook(() => useTuner());
  await act(async () => {
    await result.current.start();
  });
  expect(result.current.error).toBe('Цей браузер не дає доступу до мікрофона');
});

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

function fakeAudio() {
  const created: number[] = [];
  class FakeCtx {
    sampleRate = 44100;
    constructor() {
      created.push(1);
    }
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createAnalyser() {
      return { fftSize: 2048, getFloatTimeDomainData() {} };
    }
    close() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeCtx });
  return created;
}

function deferredStream() {
  const stop = vi.fn();
  let resolve!: (s: MediaStream) => void;
  const p = new Promise<MediaStream>((r) => (resolve = r));
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { p, stop, release: () => resolve(stream) };
}

test('подвійне натискання не відкриває мікрофон двічі', async () => {
  fakeAudio();
  const d = deferredStream();
  const getUserMedia = vi.fn(() => d.p);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const { result, unmount } = renderHook(() => useTuner());
  await act(async () => {
    const a = result.current.start();
    const b = result.current.start();
    d.release();
    await Promise.all([a, b]);
  });
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  unmount();
  expect(d.stop).toHaveBeenCalled();
});

test('вихід з вкладки під час запиту дозволу — мікрофон одразу звільняється', async () => {
  const created = fakeAudio();
  const d = deferredStream();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => d.p) } });
  const { result, unmount } = renderHook(() => useTuner());
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.start();
  });
  unmount();
  d.release();
  await pending;
  expect(d.stop).toHaveBeenCalled();
  expect(created).toHaveLength(0);
});

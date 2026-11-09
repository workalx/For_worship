import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import { PitchSmoother } from './notes';

const MIN_FREQ = 60;
const MAX_FREQ = 1200;

export function useTuner(): { start(): Promise<void>; stop(): void; freq: number | null; error: string | null; running: boolean } {
  const [freq, setFreq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  /** Номер «сеансу»: stop() і вихід з вкладки його збільшують, і запит дозволу, що запізнився, скасовується. */
  const generation = useRef(0);
  const starting = useRef(false);

  const stop = useCallback(() => {
    generation.current++;
    starting.current = false;
    cleanup.current?.();
    cleanup.current = null;
    setRunning(false);
    setFreq(null);
  }, []);

  const start = useCallback(async () => {
    if (cleanup.current || starting.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Цей браузер не дає доступу до мікрофона');
      return;
    }
    starting.current = true;
    const myGeneration = generation.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      if (myGeneration === generation.current) {
        starting.current = false;
        setError('Дозвольте доступ до мікрофона в налаштуваннях браузера');
      }
      return;
    }
    if (myGeneration !== generation.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    starting.current = false;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const detector = PitchDetector.forFloat32Array(analyser.fftSize);
    const smoother = new PitchSmoother();
    let raf = 0;

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const [pitch, clarity] = detector.findPitch(buf, ctx.sampleRate);
      const inRange = pitch >= MIN_FREQ && pitch <= MAX_FREQ;
      setFreq(smoother.push(inRange ? { freq: pitch, clarity, rms } : null));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    setRunning(true);

    cleanup.current = () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
  }, []);

  useEffect(
    () => () => {
      generation.current++;
      cleanup.current?.();
      cleanup.current = null;
    },
    [],
  );

  return { start, stop, freq, error, running };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimeSig } from '../db/db';
import { useWakeLock } from '../hooks/useWakeLock';
import { Scheduler } from './scheduler';
import { beatsPerBar, clampBpm } from './tempo';

export type Metronome = {
  bpm: number;
  setBpm: (bpm: number) => void;
  timeSig: TimeSig;
  setTimeSig: (sig: TimeSig) => void;
  running: boolean;
  toggle: () => void;
  /** Поточна доля для підсвічування (−1, коли стоїть). */
  beat: number;
};

const CLICK_SEC = 0.03;

function click(ctx: AudioContext, time: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1500 : 1000;
  gain.gain.setValueAtTime(accent ? 1 : 0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_SEC);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + CLICK_SEC);
}

/** Метроном живе в App, тож не зупиняється при переході на іншу вкладку. */
export function useMetronome(): Metronome {
  const [bpm, setBpmState] = useState(100);
  const [timeSig, setTimeSig] = useState<TimeSig>('4/4');
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const ctxRef = useRef<AudioContext | null>(null);
  const schedRef = useRef<Scheduler | null>(null);
  const timeouts = useRef<number[]>([]);

  useWakeLock(running);

  const setBpm = useCallback((n: number) => setBpmState(clampBpm(n)), []);

  useEffect(() => {
    schedRef.current?.setBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    schedRef.current?.setBeats(beatsPerBar(timeSig));
  }, [timeSig]);

  const stop = useCallback(() => {
    schedRef.current?.stop();
    timeouts.current.forEach((t) => clearTimeout(t));
    timeouts.current = [];
    setRunning(false);
    setBeat(-1);
  }, []);

  const start = useCallback(() => {
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    void ctx.resume();
    if (!schedRef.current) {
      schedRef.current = new Scheduler({
        now: () => ctx.currentTime,
        schedule: (time, b) => {
          click(ctx, time, b === 0);
          const delay = Math.max(0, (time - ctx.currentTime) * 1000);
          const id = window.setTimeout(() => {
            setBeat(b);
            timeouts.current = timeouts.current.filter((t) => t !== id);
          }, delay);
          timeouts.current.push(id);
        },
      });
    }
    schedRef.current.setBpm(bpm);
    schedRef.current.setBeats(beatsPerBar(timeSig));
    schedRef.current.start();
    schedRef.current.tick();
    setRunning(true);
  }, [bpm, timeSig]);

  const toggle = useCallback(() => (running ? stop() : start()), [running, start, stop]);

  useEffect(
    () => () => {
      schedRef.current?.stop();
      void ctxRef.current?.close();
    },
    [],
  );

  return { bpm, setBpm, timeSig, setTimeSig, running, toggle, beat };
}

import { useEffect } from 'react';

type WakeLockSentinelLike = { release(): Promise<void> };
type WakeLockLike = { request(type: 'screen'): Promise<WakeLockSentinelLike> };

/** Не дає екрану згаснути, поки active === true. Там, де API немає, нічого не робить. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!active || !wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const request = async () => {
      try {
        const s = await wl.request('screen');
        if (disposed) void s.release();
        else sentinel = s;
      } catch {
        /* браузер може відмовити (наприклад, у фоні) — це не критично */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}

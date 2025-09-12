import { useEffect, useRef, useState } from "react";

export default function useWaterTicker({ nextAt, rateMs, onTick }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, nextAt ? nextAt - Date.now() : 0)
  );
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!nextAt) {
      setRemaining(0);
      return;
    }
    let raf;
    const loop = () => {
      const r = Math.max(0, nextAt - Date.now());
      setRemaining(r);
      if (r === 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          onTick?.();
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nextAt, onTick]);

  const pctMinute = rateMs
    ? 100 - Math.min(100, Math.floor((remaining / rateMs) * 100))
    : 0;
  return { remainingMs: remaining, pctMinute, ticking: !!nextAt };
}

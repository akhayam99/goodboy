import { useEffect, useRef, useState } from 'react';
import { formatCents } from './formatCents';

type Props = {
  readonly cents: number;
};

const TWEEN_MS = 400;

const easeOutCubic = ({ progress }: { readonly progress: number }) => 1 - Math.pow(1 - progress, 3);

export const RunTotal = ({ cents }: Props) => {
  const [shown, setShown] = useState(cents);
  const shownRef = useRef(cents);

  useEffect(() => {
    const from = shownRef.current;
    if (from === cents) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shownRef.current = cents;
      setShown(cents);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) {
        start = now;
      }
      const progress = Math.min(1, (now - start) / TWEEN_MS);
      const next = from + (cents - from) * easeOutCubic({ progress });
      shownRef.current = next;
      setShown(next);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [cents]);

  return <span className="mk-total mk-num">{formatCents({ cents: Math.round(shown) })}</span>;
};

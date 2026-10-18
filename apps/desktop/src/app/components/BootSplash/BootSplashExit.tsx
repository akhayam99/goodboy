import { useEffect, useState } from 'react';
import { BootCover } from './BootCover';
import { BootStage } from './BootStage';
import { prefersReducedMotion } from './prefersReducedMotion';

const FADE_MS = 200;
const FADE_SLACK_MS = 40;

type Props = {
  readonly onDone: () => void;
};

export const BootSplashExit = ({ onDone }: Props) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    const frame = window.requestAnimationFrame(() => setIsFading(true));
    const timer = window.setTimeout(onDone, FADE_MS + FADE_SLACK_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [onDone]);

  return (
    <BootCover
      data-testid="boot-splash-exit"
      aria-hidden="true"
      className="fixed inset-0 z-50 ease-out"
      style={{
        opacity: isFading ? 0 : 1,
        pointerEvents: 'none',
        transitionProperty: 'opacity',
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      <BootStage phase="ready" />
    </BootCover>
  );
};

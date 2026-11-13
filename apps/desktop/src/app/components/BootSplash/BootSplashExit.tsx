import { useEffect, useState } from 'react';
import { BootCover } from './BootCover';
import { BootStage } from './BootStage';
import { markBoot } from '../../../shared/lib/bootMarks';
import { BOOT_SPLASH_TIMINGS } from '../../../shared/lib/bootSplashTimings';
import { prefersReducedMotion } from './prefersReducedMotion';

const FADE_MS = BOOT_SPLASH_TIMINGS.fadeMs;
const FADE_SLACK_MS = BOOT_SPLASH_TIMINGS.fadeSlackMs;

type Props = {
  readonly onDone: () => void;
};

export const BootSplashExit = ({ onDone }: Props) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const finish = () => {
      markBoot({ name: 'splash' });
      onDone();
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    const frame = window.requestAnimationFrame(() => setIsFading(true));
    const timer = window.setTimeout(finish, FADE_MS + FADE_SLACK_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [onDone]);

  return (
    <BootCover
      data-testid="boot-splash-exit"
      aria-hidden="true"
      className="fixed inset-0 z-boot ease-out"
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

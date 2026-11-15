import { useEffect } from 'react';
import { LevelsScene } from '../u25/c02LevelsScene';

const OPEN_DELAY_MS = 400;

const OPEN = { isBusy: true } as const;

export const P7SessionMenuScene = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>('button[aria-label="More session actions"]')?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return <LevelsScene config={OPEN} />;
};

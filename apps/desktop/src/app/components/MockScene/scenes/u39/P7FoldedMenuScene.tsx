import { useEffect } from 'react';
import { LevelsScene } from '../u25/c02LevelsScene';

const OPEN_DELAY_MS = 400;

const FOLDED = { isBusy: true, isRailFolded: true } as const;

export const P7FoldedMenuScene = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-rail-actions] button[aria-label="More session actions"]')
        ?.click();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return <LevelsScene config={FOLDED} />;
};

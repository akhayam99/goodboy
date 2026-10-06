import { useEffect } from 'react';
import { BrandDiffScene } from './brand/DiffScene';
import { useSplitDiffPreference } from './useSplitDiffPreference';

const COMPOSER_DELAY_MS = 400;

export const SpaceDiffCommentScene = () => {
  const isReady = useSplitDiffPreference();
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      const gutter = document.querySelector<HTMLElement>('[data-gutter^="new:"]');
      gutter?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }, COMPOSER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady]);
  return isReady ? <BrandDiffScene /> : null;
};

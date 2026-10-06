import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { BrandDiffScene } from './brand/DiffScene';

const COMPOSER_DELAY_MS = 400;

const useSplitPreference = (): boolean => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.diffLayoutMode, 'split');
    } catch {
      return;
    } finally {
      setIsReady(true);
    }
  }, []);
  return isReady;
};

export const SpaceDiffSplitScene = () => {
  const isReady = useSplitPreference();
  return isReady ? <BrandDiffScene /> : null;
};

export const SpaceDiffCommentScene = () => {
  const isReady = useSplitPreference();
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

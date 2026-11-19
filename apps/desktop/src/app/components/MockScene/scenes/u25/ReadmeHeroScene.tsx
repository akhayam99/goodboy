import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { ActivityRunScene } from '../ActivityRunScene';
import { seedActivityResolvesScene } from '../activityResolvesSeed';
import { useSceneClicks } from '../audit/useSceneClicks';
import { seedReadmeHero } from './readmeHeroSeed';

const OPEN_GROUPS: ReadonlyArray<string> = ['subagents'];

const READY_DELAY_MS = 400;
const SCROLL_EVERY_MS = 500;
const SCROLL_HOLD_MS = 10_000;

const scrollPageToTop = (): void => {
  const scroller = document.querySelector<HTMLElement>('[data-page-scroller]');
  if (scroller === null) {
    return;
  }
  scroller.scrollTop = 0;
};

export const ReadmeHeroScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(scrollPageToTop, SCROLL_EVERY_MS);
    const timer = window.setTimeout(() => window.clearInterval(interval), SCROLL_HOLD_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [isReady]);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), READY_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      try {
        localStorage.removeItem(STORAGE_KEYS.sessionRailFoldedCards);
        localStorage.removeItem(STORAGE_KEYS.sessionRailTreeOpen);
      } catch {
        return;
      }
    };
  }, []);
  useSceneClicks({
    isReady,
    labels: OPEN_GROUPS,
    selector: '[data-row-id] button',
    match: 'contains',
    intervalMs: 300,
  });
  return (
    <ActivityRunScene
      seedRuns={seedActivityResolvesScene}
      onSeeded={seedReadmeHero}
      isPageFollowed
      isContextRead
    />
  );
};

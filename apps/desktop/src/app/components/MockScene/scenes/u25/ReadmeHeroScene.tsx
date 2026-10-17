import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { ActivityRunScene } from '../ActivityRunScene';
import { seedActivityResolvesScene } from '../activityResolvesSeed';
import { useSceneClicks } from '../audit/useSceneClicks';
import { seedReadmeHero } from './readmeHeroSeed';

const OPEN_GROUPS: ReadonlyArray<string> = ['subagents'];

const READY_DELAY_MS = 400;

export const ReadmeHeroScene = () => {
  const [isReady, setIsReady] = useState(false);
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
    />
  );
};

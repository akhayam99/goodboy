import { ActivityRunScene } from '../ActivityRunScene';
import { seedActivityResolvesScene } from '../activityResolvesSeed';
import { seedReadmeHeroLog } from './readmeHeroLogSeed';

export const ReadmeHeroLogScene = () => (
  <ActivityRunScene
    seedRuns={seedActivityResolvesScene}
    onSeeded={seedReadmeHeroLog}
    isLogShown
    isLogTitled
  />
);

import type { ComponentType } from 'react';
import { serializeHomeLayout } from '../../../../../../features/home/layout/serializeHomeLayout';
import { HomePlaceScene } from './HomePlaceScene';

const BUSY_LAYOUT = serializeHomeLayout({
  entries: [
    { id: 'sessionsToFinish', size: 'L' },
    { id: 'needsYou', size: 'M' },
    { id: 'runningNow', size: 'S' },
    { id: 'providerLimits', size: 'M' },
    { id: 'spend', size: 'S' },
    { id: 'tasksInbox', size: 'S' },
    { id: 'mergedThisWeek', size: 'M' },
    { id: 'workflowRules', size: 'S' },
  ],
});

export const HOME_PLACE_SCENES = {
  'home-place': () => <HomePlaceScene theme="dark" />,
  'home-place-light': () => <HomePlaceScene theme="light" />,
  'home-busy': () => <HomePlaceScene theme="dark" layout={BUSY_LAYOUT} />,
  'home-busy-light': () => <HomePlaceScene theme="light" layout={BUSY_LAYOUT} />,
} satisfies Readonly<Record<string, ComponentType>>;

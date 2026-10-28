import type { DemoTimeline, TimelineParams } from './directorTypes';
import { resolveTimeline } from './resolveTimeline';
import { storageTimeline } from './storageTimeline';
import { storyDirectionTimeline } from './storyDirectionTimeline';
import { storyPlanTimeline } from './storyPlanTimeline';

export const DEMO_TIMELINES: ReadonlyMap<string, (params: TimelineParams) => DemoTimeline | null> =
  new Map([
    ['story-direction', storyDirectionTimeline],
    ['story-plan', storyPlanTimeline],
    ['story-review', resolveTimeline],
    ['demo-storage', storageTimeline],
  ]);

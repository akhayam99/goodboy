import type { DemoTimeline } from './directorTypes';
import { installStoryPlan } from './installStoryPlan';

export const storyPlanTimeline = (): DemoTimeline => ({
  setup: installStoryPlan,
  prepare: () => undefined,
  cues: [],
});

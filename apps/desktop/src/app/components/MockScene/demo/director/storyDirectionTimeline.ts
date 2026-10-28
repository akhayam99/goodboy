import type { DemoTimeline } from './directorTypes';
import { installStoryDirection } from './installStoryDirection';

export const storyDirectionTimeline = (): DemoTimeline => ({
  setup: installStoryDirection,
  prepare: () => undefined,
  cues: [],
});

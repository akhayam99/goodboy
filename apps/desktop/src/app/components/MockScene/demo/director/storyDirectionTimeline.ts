import type { DemoTimeline } from './directorTypes';
import { installStoryFlow } from './installStoryFlow';

export const storyDirectionTimeline = (): DemoTimeline => ({
  setup: installStoryFlow,
  prepare: () => undefined,
  cues: [],
});

import type { DemoTimeline } from './directorTypes';
import { installStoryReview } from './installStoryReview';

export const resolveTimeline = (): DemoTimeline => ({
  setup: installStoryReview,
  prepare: () => undefined,
  cues: [],
});

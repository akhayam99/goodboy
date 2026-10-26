import type { DemoTimeline } from './directorTypes';
import { installResolveActions } from './installResolveActions';
import { installReviewStory } from './installReviewStory';

export const resolveTimeline = (): DemoTimeline => ({
  setup: ({ store }) => {
    installResolveActions({ store });
    installReviewStory({ store });
  },
  prepare: () => undefined,
  cues: [],
});

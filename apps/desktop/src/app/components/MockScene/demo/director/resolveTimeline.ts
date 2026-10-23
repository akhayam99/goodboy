import type { DemoTimeline } from './directorTypes';
import { installResolveActions } from './installResolveActions';

export const resolveTimeline = (): DemoTimeline => ({
  setup: installResolveActions,
  prepare: () => undefined,
  cues: [],
});

import type { DemoTimeline } from './directorTypes';
import { installStorageActions } from './installStorageActions';

export const storageTimeline = (): DemoTimeline => ({
  setup: installStorageActions,
  prepare: () => undefined,
  cues: [],
});

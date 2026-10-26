import type { DemoTimeline } from './directorTypes';
import { installPresetActions } from './installPresetActions';

export const presetTimeline = (): DemoTimeline => ({
  setup: installPresetActions,
  prepare: () => undefined,
  cues: [],
});

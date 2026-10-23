import type { DemoTimeline } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';

export const worldTimeline = (): DemoTimeline => ({
  setup: installDemoWorld,
  prepare: () => undefined,
  cues: [],
});

import type { DemoTimeline } from './directorTypes';
import { installRunActions } from './runActions';

export const runFlowTimeline = (): DemoTimeline => ({
  setup: installRunActions,
  prepare: () => undefined,
  cues: [],
});

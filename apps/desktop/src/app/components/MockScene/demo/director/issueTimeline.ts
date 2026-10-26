import type { DemoTimeline } from './directorTypes';
import { installIssueStart } from './installIssueStart';

export const issueTimeline = (): DemoTimeline => ({
  setup: installIssueStart,
  prepare: () => undefined,
  cues: [],
});

import type { ActivityRowTone, WorkNodeState } from '@goodboy/ui';

export const ACTIVITY_TONE_OF_NODE: Record<WorkNodeState, ActivityRowTone> = {
  queued: 'pending',
  ready: 'attention',
  running: 'live',
  question: 'attention',
  budget: 'attention',
  approval: 'attention',
  alert: 'attention',
  failed: 'failed',
  approved: 'quiet',
  merging: 'live',
  done: 'quiet',
  finished: 'quiet',
  closed: 'pending',
  stopped: 'pending',
  skipped: 'pending',
  marker: 'quiet',
  mixed: 'quiet',
};

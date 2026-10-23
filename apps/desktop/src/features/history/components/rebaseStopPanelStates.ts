import type { RebaseJobState } from '../rebaseJob';

export const REBASE_STOP_PANEL_STATES: ReadonlySet<RebaseJobState> = new Set<RebaseJobState>([
  'conflict',
  'rebasing-here',
  'auto-resolving',
  'auto-done',
  'rebased-here',
  'pushed',
  'origin-moved',
  'push-failed',
  'dirty',
  'head-moved',
  'blocked',
  'result-differs',
  'failed',
]);

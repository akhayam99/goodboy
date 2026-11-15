import type { DelegationState, DelegationStatus } from '../../auto/chat/settledStatusOf';
import type { Glance, GlanceState } from './glanceOf';

type Params = {
  readonly status: DelegationStatus;
};

const GLANCE_STATE: Readonly<Record<DelegationState, GlanceState>> = {
  stopping: 'stopping',
  queued: 'queued',
  confirming: 'waiting',
  starting: 'running',
  running: 'running',
  paused: 'waiting',
  done: 'done',
  failed: 'failed',
  blocked: 'waiting',
  returned: 'idle',
  stopped: 'stopped',
  timedOut: 'failed',
};

export const delegationGlanceOf = ({ status }: Params): Glance => ({
  state: GLANCE_STATE[status.state],
  word: status.word,
  tone: status.tone,
  sentence: '',
  isLive: status.isLive,
});

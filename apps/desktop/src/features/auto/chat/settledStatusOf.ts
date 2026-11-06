import type { AutoOutcome } from '@goodboy/db';
import type { Tone, WorkNodeState } from '@goodboy/ui';

export type DelegationState =
  | 'stopping'
  | 'queued'
  | 'confirming'
  | 'starting'
  | 'running'
  | 'paused'
  | 'done'
  | 'failed'
  | 'blocked'
  | 'stopped'
  | 'timedOut';

export type DelegationStatus = Readonly<{
  state: DelegationState;
  word: string;
  tone: Tone;
  isLive: boolean;
  node?: WorkNodeState;
}>;

const SETTLED_STATUS: Readonly<Record<AutoOutcome, DelegationStatus>> = {
  completed: { state: 'done', word: 'Done', tone: 'success', isLive: false },
  failed: { state: 'failed', word: 'Failed', tone: 'danger', isLive: false },
  blocked: { state: 'blocked', word: 'Blocked', tone: 'warning', isLive: false },
  stopped: { state: 'stopped', word: 'Stopped', tone: 'neutral', isLive: false },
  timed_out: { state: 'timedOut', word: 'Timed out', tone: 'warning', isLive: false },
};

type Params = {
  readonly outcome: AutoOutcome;
};

export const settledStatusOf = ({ outcome }: Params): DelegationStatus => SETTLED_STATUS[outcome];

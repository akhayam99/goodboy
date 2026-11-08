import type { AutoOutcome } from '@goodboy/db';
import type { Tone, WorkNodeState } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';

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
  | 'returned'
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
  completed: { state: 'done', word: NAMES.done, tone: 'success', isLive: false },
  failed: { state: 'failed', word: NAMES.failed, tone: 'danger', isLive: false },
  blocked: { state: 'blocked', word: NAMES.needsYou, tone: 'warning', isLive: false },
  stopped: { state: 'stopped', word: NAMES.stopped, tone: 'neutral', isLive: false },
  timed_out: { state: 'timedOut', word: NAMES.failed, tone: 'danger', isLive: false },
};

type Params = {
  readonly outcome: AutoOutcome;
};

export const settledStatusOf = ({ outcome }: Params): DelegationStatus => SETTLED_STATUS[outcome];

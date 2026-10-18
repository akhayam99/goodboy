import type { AutoOutcome } from '@goodboy/db';
import type { Tone, WorkNodeState } from '@goodboy/ui';

export type DelegationStatus = Readonly<{
  word: string;
  tone: Tone;
  isLive: boolean;
  node?: WorkNodeState;
}>;

const SETTLED_STATUS: Readonly<Record<AutoOutcome, DelegationStatus>> = {
  completed: { word: 'Done', tone: 'success', isLive: false },
  failed: { word: 'Failed', tone: 'danger', isLive: false },
  blocked: { word: 'Blocked', tone: 'warning', isLive: false },
  stopped: { word: 'Stopped', tone: 'neutral', isLive: false },
  timed_out: { word: 'Timed out', tone: 'warning', isLive: false },
};

type Params = {
  readonly outcome: AutoOutcome;
};

export const settledStatusOf = ({ outcome }: Params): DelegationStatus => SETTLED_STATUS[outcome];

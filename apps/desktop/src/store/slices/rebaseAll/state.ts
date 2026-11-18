import type { MountId, SessionId } from '@goodboy/types';
import type { RebaseAllRun } from './types';
import { readSettledStops } from './readSettledStops';
import type { SettledStops } from './settledStopsMemory';

export type RebaseAllState = {
  readonly rebaseAllRuns: Readonly<Record<SessionId, RebaseAllRun | undefined>>;
  readonly settledRebaseStops: SettledStops;
  readonly rebaseSettleLines: Readonly<Record<MountId, number>>;
};

export const rebaseAllInitialState: RebaseAllState = {
  rebaseAllRuns: {},
  settledRebaseStops: readSettledStops(),
  rebaseSettleLines: {},
};

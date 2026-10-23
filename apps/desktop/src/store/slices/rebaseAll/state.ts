import type { SessionId } from '@goodboy/types';
import type { RebaseAllRun } from './types';

export type RebaseAllState = {
  readonly rebaseAllRuns: Readonly<Record<SessionId, RebaseAllRun | undefined>>;
  readonly settledRebaseStops: Readonly<Record<SessionId, ReadonlyArray<string> | undefined>>;
};

export const rebaseAllInitialState: RebaseAllState = {
  rebaseAllRuns: {},
  settledRebaseStops: {},
};

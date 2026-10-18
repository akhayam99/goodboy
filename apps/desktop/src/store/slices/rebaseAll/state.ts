import type { SessionId } from '@goodboy/types';
import type { RebaseAllRun } from './types';

export type RebaseAllState = {
  readonly rebaseAllRuns: Readonly<Record<SessionId, RebaseAllRun | undefined>>;
};

export const rebaseAllInitialState: RebaseAllState = {
  rebaseAllRuns: {},
};

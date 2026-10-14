import type { AgentId } from '@goodboy/types';
import type { CheckFixCommit } from './types';

export type CheckFixCommitsState = {
  readonly checkFixCommits: Readonly<Record<AgentId, CheckFixCommit>>;
};

export const checkFixCommitsInitialState: CheckFixCommitsState = {
  checkFixCommits: {},
};

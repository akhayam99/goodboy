import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { PullOutcome } from '../../../features/workspace/pullBase/pullBaseInRepos';

export type { GetFn, SetFn } from '../../slice-types';

type CheckRepoDivergenceParams = {
  readonly workspaceId: WorkspaceId;
  readonly maxAgeMs: number;
};

export type CheckOutcome = 'checked' | 'skipped';

type PullRepoBasesParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectIds: ReadonlyArray<ProjectId>;
};

export type RepoDivergenceSlice = {
  checkRepoDivergence(params: CheckRepoDivergenceParams): Promise<CheckOutcome>;
  pullRepoBases(params: PullRepoBasesParams): Promise<ReadonlyArray<PullOutcome>>;
};

import type { SessionRun } from '../../../../sessionRunsOf';

export type BranchGroupRuns = Readonly<{
  active: ReadonlyArray<SessionRun>;
  finished: ReadonlyArray<SessionRun>;
  archived: ReadonlyArray<SessionRun>;
}>;

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
};

type KeyParams = {
  readonly groupKey: string;
};

export const branchGroupRunsOf = ({ runs }: Params): BranchGroupRuns => ({
  active: runs.filter((run) => !run.isFinished && !run.isArchived),
  finished: runs.filter((run) => run.isFinished && !run.isArchived),
  archived: runs.filter((run) => run.isArchived),
});

export const archivedFoldKeyOf = ({ groupKey }: KeyParams): string => `${groupKey}/archived`;

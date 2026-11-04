import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';
import { branchRowFactsOf } from '../../../features/branch/branchRowFactsOf';
import {
  pullRequestStateToneOf,
  type PullRequestStateTone,
} from '../../../features/branch/pullRequestStateToneOf';

type Params = {
  readonly row: MountRowView;
};

export type RailBranchFacts = {
  readonly stateWord: string | null;
  readonly mark: PullRequestStateTone;
  readonly parts: ReadonlyArray<string>;
  readonly path: string | null;
};

export const railBranchFactsOf = ({ row }: Params): RailBranchFacts => {
  const facts = branchRowFactsOf({
    branch: row.branch,
    mountName: row.mountName,
    request: row.request,
    checks: null,
    behind: null,
    conflicts: null,
  });
  return {
    stateWord: facts.stateWord,
    mark: pullRequestStateToneOf({ state: facts.state }),
    parts: [row.projectName, facts.number, facts.branch, facts.stateWord].filter(
      (part): part is string => part !== null && part !== '',
    ),
    path: row.worktreePath ?? row.lastWorktreePath,
  };
};

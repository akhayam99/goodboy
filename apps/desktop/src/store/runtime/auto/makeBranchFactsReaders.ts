import type { CommitRangeParams, RangeCommit } from '../../../features/worktree/worktree';
import type { AppStore } from '../../store';
import { selectMountBaseBranch } from '../../slices/project-mounts/selectors';
import type { BranchFactsReaders } from './branchFacts/readBranchFactsOf';
import { readMountRequest } from './branchFacts/readMountRequest';
import { readMountThreads } from './branchFacts/readMountThreads';

export type MakeBranchFactsReadersParams = Readonly<{
  getState: () => AppStore;
  commitRange: (params: CommitRangeParams) => Promise<ReadonlyArray<RangeCommit>>;
}>;

export const makeBranchFactsReaders = ({
  getState,
  commitRange,
}: MakeBranchFactsReadersParams): BranchFactsReaders => ({
  commits: async ({ sessionId, worktreePath }) => {
    const base = selectMountBaseBranch({ state: getState(), sessionId, path: worktreePath });
    if (base === null) {
      throw new Error('this mount has no base branch');
    }
    const range = await commitRange({ worktreePath, base: `origin/${base}`, head: 'HEAD' }).catch(
      () => commitRange({ worktreePath, base, head: 'HEAD' }),
    );
    return range.map((commit) => ({ sha: commit.sha, subject: commit.subject }));
  },
  request: ({ sessionId, mountId, worktreePath, branch }) =>
    readMountRequest({ getState, params: { sessionId, mountId, worktreePath, branch } }),
  threads: ({ params, request }) => readMountThreads({ getState, params, request }),
});

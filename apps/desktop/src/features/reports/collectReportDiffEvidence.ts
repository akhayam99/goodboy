import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectActiveMount } from '../../store/slices/project-mounts/selectors';
import { listBranchCommits, worktreeChangedFiles } from '../worktree/worktree';
import type { ReportDiffEvidence, ReportDiffUnavailableReason } from './buildReportContext';

export type ReportDiffCollection = Readonly<{
  evidence: ReportDiffEvidence | null;
  reason: ReportDiffUnavailableReason | null;
}>;

type Params = Readonly<{
  state: AppState;
  sessionId: SessionId;
}>;

export const collectReportDiffEvidence = async ({
  state,
  sessionId,
}: Params): Promise<ReportDiffCollection> => {
  const mount = selectActiveMount({ state, sessionId });
  if (mount === null || mount.worktreePath.length === 0) {
    return { evidence: null, reason: 'no-mount' };
  }
  const baseBranch = mount.baseBranch ?? 'main';
  try {
    const [changed, commits] = await Promise.all([
      worktreeChangedFiles({ worktreePath: mount.worktreePath, baseBranch }),
      listBranchCommits(mount.worktreePath).catch(() => []),
    ]);
    return {
      evidence: {
        mountName: mount.mountName,
        baseBranch,
        headSha: commits[0]?.sha ?? null,
        commits: commits.map((commit) => ({ sha: commit.shortSha, subject: commit.subject })),
        additions: changed.additions,
        deletions: changed.deletions,
        paths: changed.paths,
      },
      reason: null,
    };
  } catch {
    return { evidence: null, reason: 'unreadable' };
  }
};

import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { resolveArtifactMounts } from '../artifacts/artifactMountChoice';
import { listBranchCommits, worktreeChangedFiles } from '../worktree/worktree';
import type { ReportDiffEvidence, ReportDiffUnavailableReason } from './buildReportContext';

export type ReportDiffCollection = Readonly<{
  mountId: MountId | null;
  evidence: ReportDiffEvidence | null;
  reason: ReportDiffUnavailableReason | null;
}>;

type Params = Readonly<{
  state: AppState;
  sessionId: SessionId;
  mountIds: ReadonlyArray<MountId>;
}>;

export const collectReportDiffEvidence = async ({
  state,
  sessionId,
  mountIds,
}: Params): Promise<ReportDiffCollection> => {
  const mount = resolveArtifactMounts({ state, sessionId, mountIds })[0] ?? null;
  if (mount === null) {
    return { mountId: null, evidence: null, reason: 'no-mount' };
  }
  const baseBranch = mount.baseBranch ?? 'main';
  try {
    const [changed, commits] = await Promise.all([
      worktreeChangedFiles({ worktreePath: mount.worktreePath, baseBranch }),
      listBranchCommits(mount.worktreePath).catch(() => []),
    ]);
    return {
      mountId: mount.mountId,
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
    return { mountId: mount.mountId, evidence: null, reason: 'unreadable' };
  }
};

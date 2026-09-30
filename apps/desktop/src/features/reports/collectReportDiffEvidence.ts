import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { resolveArtifactMounts, type ArtifactMountOption } from '../artifacts/artifactMountChoice';
import { resolveMountBaseBranch } from '../../store/slices/project-mounts/selectors';
import { listBranchCommits, worktreeChangedFiles } from '../worktree/worktree';
import type { ReportDiffEvidence, ReportDiffUnavailableReason } from './buildReportContext';

type ReportDiffMount = Readonly<{
  mountId: MountId;
  evidence: ReportDiffEvidence | null;
  reason: ReportDiffUnavailableReason | null;
}>;

export type ReportDiffCollection = Readonly<{
  mountId: MountId | null;
  evidence: ReportDiffEvidence | null;
  reason: ReportDiffUnavailableReason | null;
  mounts: ReadonlyArray<ReportDiffMount>;
  changedMountIds: ReadonlyArray<MountId>;
  paths: ReadonlyArray<string>;
}>;

type Params = Readonly<{
  state: Pick<
    AppState,
    'sessions' | 'sessionMounts' | 'sessionProjectMounts' | 'sessionActiveMount' | 'projects'
  >;
  sessionId: SessionId;
  mountIds: ReadonlyArray<MountId>;
}>;

type DiffParams = Readonly<{
  mount: ArtifactMountOption;
  projects: AppState['projects'];
}>;

const diffOf = async ({ mount, projects }: DiffParams): Promise<ReportDiffMount> => {
  const baseBranch = resolveMountBaseBranch({ mount, projects });
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

export const collectReportDiffEvidence = async ({
  state,
  sessionId,
  mountIds,
}: Params): Promise<ReportDiffCollection> => {
  const mounts = resolveArtifactMounts({ state, sessionId, mountIds });
  if (mounts.length === 0) {
    return {
      mountId: null,
      evidence: null,
      reason: 'no-mount',
      mounts: [],
      changedMountIds: [],
      paths: [],
    };
  }
  const rows = await Promise.all(
    mounts.map((mount) => diffOf({ mount, projects: state.projects })),
  );
  const changed = rows.filter((row) => (row.evidence?.paths.length ?? 0) > 0);
  const first = rows[0] ?? null;
  return {
    mountId: first?.mountId ?? null,
    evidence: first?.evidence ?? null,
    reason: first?.reason ?? null,
    mounts: rows,
    changedMountIds: changed.map((row) => row.mountId),
    paths: [...new Set(changed.flatMap((row) => row.evidence?.paths ?? []))],
  };
};

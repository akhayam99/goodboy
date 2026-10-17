import { useMemo } from 'react';
import type { SessionId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { resolveMountBaseBranch } from '../../../../../store/slices/project-mounts/selectors';
import { useBranchIdentity } from '../../../../../features/branch/hooks/useBranchIdentity';
import { useWorktreeStatusSnapshot } from '../../../../../features/session/hooks/useWorktreeStatuses';
import { useMountRemoteHostKind } from '../../../../../features/worktree/useMountRemoteHostKind';
import type { MountActionTarget } from '../../../../../features/actions/types';

type Params = {
  readonly sessionId: SessionId;
};

export type WorktreeTarget = {
  readonly mount: SessionProjectMount | null;
  readonly mountPath: string | null;
  readonly projectName: string | null;
  readonly baseBranch: string | null;
  readonly status: WorktreeStatus | null;
  readonly target: MountActionTarget | null;
};

export const useWorktreeTarget = ({ sessionId }: Params): WorktreeTarget => {
  const identity = useBranchIdentity({ sessionId });
  const { mount, mountPath } = identity;
  const projects = useAppStore((state) => state.projects);
  const projectName = projectById(projects, mount?.projectId ?? null)?.name ?? null;
  const baseBranch = resolveMountBaseBranch({ mount, projects });
  const targets = useMemo(
    () =>
      mountPath === null || mountPath === ''
        ? []
        : [{ worktreePath: mountPath, ...(baseBranch !== null && { baseBranch }) }],
    [baseBranch, mountPath],
  );
  const snapshot = useWorktreeStatusSnapshot({ targets });
  const status = mountPath === null ? null : (snapshot.statuses.get(mountPath) ?? null);
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: mount?.repoRoot ?? null });
  const mountId = mount?.mountId ?? null;
  const target = useMemo<MountActionTarget | null>(
    () => (mountId === null ? null : { kind: 'mount', sessionId, mountId, status, remoteKind }),
    [mountId, remoteKind, sessionId, status],
  );
  return { mount, mountPath, projectName, baseBranch, status, target };
};

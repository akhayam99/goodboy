import { useMemo } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { findMountById } from '../../../../store/slices/project-mounts/findMountById';
import type { MountActionTarget } from '../../../actions/types';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import { useWorktreeStatuses } from '../useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../useWorktreeStatuses/targets';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const useMountMenuTarget = ({ sessionId, mountId }: Params): MountActionTarget => {
  const mount = useAppStore((state) =>
    findMountById({ mounts: state.sessionProjectMounts[sessionId] ?? [], mountId }),
  );
  const projects = useAppStore((state) => state.projects);
  const targets = useMemo(
    () => (mount === null ? [] : worktreeStatusTargetsOf({ mounts: [mount], projects })),
    [mount, projects],
  );
  const statuses = useWorktreeStatuses({ targets });
  const [statusTarget] = targets;
  const status =
    statusTarget === undefined ? null : (statuses.get(statusTarget.worktreePath) ?? null);
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: mount?.repoRoot ?? null });
  return useMemo<MountActionTarget>(
    () => ({ kind: 'mount', sessionId, mountId, status, remoteKind }),
    [mountId, remoteKind, sessionId, status],
  );
};

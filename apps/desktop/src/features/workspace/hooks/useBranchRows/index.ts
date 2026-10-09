import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { mountRequestOf } from '../../../../store/slices/project-mounts/mountRowModel';
import { resolveActiveMountPath } from '../../../../store/slices/worktrees/resolveActiveMountPath';
import { branchRowsOf, type BranchRows } from '../../components/SessionActivityBar/branchRowModels';

type Params = {
  readonly sessionId: SessionId;
};

export type SessionBranchRows = BranchRows & {
  readonly total: number;
};

export const useBranchRows = ({ sessionId }: Params): SessionBranchRows => {
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const requestedPath = useAppStore((s) => s.diffMountPath[sessionId] ?? null);
  const activePath = useAppStore((s) => resolveActiveMountPath({ state: s, sessionId }));
  const mountGithub = useAppStore((s) => s.mountGithub);
  const mountGitlabMr = useAppStore((s) => s.mountGitlabMr);
  const mountBitbucketPr = useAppStore((s) => s.mountBitbucketPr);

  return useMemo(() => {
    const isRequestedMounted =
      requestedPath !== null && mounts.some((mount) => mount.worktreePath === requestedPath);
    const currentPath = isRequestedMounted
      ? requestedPath
      : (activePath ?? mounts[0]?.worktreePath ?? null);
    const rows = branchRowsOf({
      mounts,
      currentPath,
      requestOf: (mount) => {
        const request = mountRequestOf({
          state: { mountGithub, mountGitlabMr, mountBitbucketPr },
          mountId: mount.mountId,
        });
        return request === null
          ? null
          : { number: request.number, state: request.state, isDraft: request.isDraft };
      },
    });
    return { ...rows, total: mounts.length };
  }, [activePath, mountBitbucketPr, mountGithub, mountGitlabMr, mounts, requestedPath]);
};

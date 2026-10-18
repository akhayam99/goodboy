import type { MountId, Project, SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { distanceBehind } from '../../shared/lib/gitStatus';
import { isMountCompleted } from '../../store/slices/project-mounts/mountRowModel';
import { resolveMountBaseBranch } from '../../store/slices/project-mounts/selectors';
import { readWorktreeStatus, worktreeStatusKey } from '../../store/slices/worktreeStatuses/cache';

export const REBASE_ALL_MIN_BRANCHES = 2;

export type BehindBranch = {
  readonly mountId: MountId;
  readonly behind: number;
};

export type RebaseStatusTarget = {
  readonly mountId: MountId;
  readonly key: string;
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

type TargetsParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
};

export const rebaseStatusTargetsOf = ({
  mounts,
  projects,
}: TargetsParams): ReadonlyArray<RebaseStatusTarget> =>
  mounts.flatMap((mount): ReadonlyArray<RebaseStatusTarget> => {
    if (!mount.isAttached || mount.worktreePath === '' || mount.branch === '') {
      return [];
    }
    const baseBranch = resolveMountBaseBranch({ mount, projects });
    return [
      {
        mountId: mount.mountId,
        key: worktreeStatusKey({
          worktreePath: mount.worktreePath,
          ...(baseBranch !== null && { baseBranch }),
        }),
        worktreePath: mount.worktreePath,
        baseBranch,
      },
    ];
  });

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const behindBranchesOf = ({ state, sessionId }: Params): ReadonlyArray<BehindBranch> =>
  rebaseStatusTargetsOf({
    mounts: state.sessionProjectMounts[sessionId] ?? [],
    projects: state.projects,
  }).flatMap((target): ReadonlyArray<BehindBranch> => {
    if (isMountCompleted({ state, mountId: target.mountId })) {
      return [];
    }
    const status = readWorktreeStatus(target.key);
    const behind = status === null ? null : distanceBehind({ distance: status.mainDistance });
    return behind !== null && behind > 0 && status?.inProgress !== 'rebase'
      ? [{ mountId: target.mountId, behind }]
      : [];
  });

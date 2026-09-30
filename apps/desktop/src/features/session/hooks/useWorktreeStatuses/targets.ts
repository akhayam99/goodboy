import type { Project, ProjectId } from '@goodboy/types';
import { resolveMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';

type TargetMount = {
  readonly projectId: ProjectId;
  readonly worktreePath: string | null;
  readonly isAttached: boolean;
  readonly baseBranch: string | null;
};

type Params = {
  readonly mounts: ReadonlyArray<TargetMount>;
  readonly projects: ReadonlyArray<Project>;
};

export type WorktreeStatusTarget = {
  readonly worktreePath: string;
  readonly baseBranch?: string;
};

export const worktreeStatusTargetsOf = ({
  mounts,
  projects,
}: Params): ReadonlyArray<WorktreeStatusTarget> =>
  mounts.flatMap((mount): ReadonlyArray<WorktreeStatusTarget> => {
    if (mount.worktreePath === null || mount.worktreePath === '' || !mount.isAttached) {
      return [];
    }
    const baseBranch = resolveMountBaseBranch({ mount, projects });
    return [
      baseBranch === null
        ? { worktreePath: mount.worktreePath }
        : { worktreePath: mount.worktreePath, baseBranch },
    ];
  });

import type { MountId, Project, SessionProjectMount } from '@goodboy/types';
import { worktreeChangedFiles } from '../../../features/worktree/worktree';
import { resolveMountBaseBranch } from '../project-mounts/selectors';
import type { MountChangeSnapshot } from './touchedMountIds';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projects: ReadonlyArray<Project>;
};

export const snapshotMountChanges = async ({
  mounts,
  projects,
}: Params): Promise<MountChangeSnapshot> => {
  const entries = await Promise.all(
    mounts.map(async (mount): Promise<readonly [MountId, string] | null> => {
      try {
        const changed = await worktreeChangedFiles({
          worktreePath: mount.worktreePath,
          baseBranch: resolveMountBaseBranch({ mount, projects }),
        });
        return [mount.mountId, changed.numstat];
      } catch {
        return null;
      }
    }),
  );
  return new Map(entries.filter((entry) => entry !== null));
};

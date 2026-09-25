import type { MountId, SessionProjectMount } from '@goodboy/types';
import { worktreeChangedFiles } from '../../../features/worktree/worktree';
import type { MountChangeSnapshot } from './touchedMountIds';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

export const snapshotMountChanges = async ({ mounts }: Params): Promise<MountChangeSnapshot> => {
  const entries = await Promise.all(
    mounts.map(async (mount): Promise<readonly [MountId, string] | null> => {
      try {
        const changed = await worktreeChangedFiles({ worktreePath: mount.worktreePath });
        return [mount.mountId, changed.numstat];
      } catch {
        return null;
      }
    }),
  );
  return new Map(entries.filter((entry) => entry !== null));
};

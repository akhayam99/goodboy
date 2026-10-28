import type { MountId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import {
  isMountRequestMerged,
  mountRequestOf,
} from '../../../store/slices/project-mounts/mountRowModel';

export type MergedMount = {
  readonly mountId: MountId;
  readonly branch: string;
  readonly label: string;
  readonly mergedHeadSha: string | null;
};

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export type MergedFacts = {
  readonly mergedMountIds: ReadonlyArray<MountId>;
  readonly mergedBranches: ReadonlyArray<string>;
};

export const mergedFactsOf = ({ state, sessionId }: Params): MergedFacts => {
  const mounts = mergedMountsOf({ state, sessionId });
  return {
    mergedMountIds: mounts.map((mount) => mount.mountId),
    mergedBranches: mounts.map((mount) => mount.branch),
  };
};

export const mergedMountsOf = ({ state, sessionId }: Params): ReadonlyArray<MergedMount> =>
  (state.sessionProjectMounts[sessionId] ?? []).flatMap((mount): ReadonlyArray<MergedMount> => {
    if (!mount.isAttached || mount.worktreePath === '' || mount.branch === '') {
      return [];
    }
    if (!isMountRequestMerged({ state, mountId: mount.mountId })) {
      return [];
    }
    return [
      {
        mountId: mount.mountId,
        branch: mount.branch,
        label: mount.branch,
        mergedHeadSha: mountRequestOf({ state, mountId: mount.mountId })?.mergedHeadSha ?? null,
      },
    ];
  });

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  isMountCompleted,
  isMountRequestMerged,
} from '../../../../store/slices/project-mounts/mountRowModel';
import { settledMountIdsOf } from '../../../../store/slices/project-mounts/workRecord/settledMountIdsOf';
import type { SettledBranches } from '../../archiveSuggestionOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type Result = {
  readonly completedMountIds: ReadonlyArray<MountId>;
  readonly rebaseMounts: ReadonlyArray<SessionProjectMount>;
  readonly settledBranches: SettledBranches;
  readonly settledMountIds: ReadonlyArray<MountId>;
};

export const useSettledMounts = ({ sessionId, mounts }: Params): Result => {
  const completedMountIds = useAppStore(
    useShallow((state) =>
      mounts.flatMap((mount) =>
        isMountCompleted({ state, mountId: mount.mountId }) ? [mount.mountId] : [],
      ),
    ),
  );
  const settledMountIds = useAppStore(
    useShallow((state) => settledMountIdsOf({ state, sessionId })),
  );
  const rebaseMounts = useMemo(
    () => mounts.filter((mount) => !completedMountIds.includes(mount.mountId)),
    [completedMountIds, mounts],
  );
  const mergedMountCount = useAppStore(
    (state) =>
      completedMountIds.filter((mountId) => isMountRequestMerged({ state, mountId })).length,
  );
  const settledBranches = useMemo(
    () =>
      rebaseMounts.length > 0
        ? { merged: 0, closed: 0 }
        : { merged: mergedMountCount, closed: completedMountIds.length - mergedMountCount },
    [completedMountIds.length, mergedMountCount, rebaseMounts.length],
  );
  return { completedMountIds, rebaseMounts, settledBranches, settledMountIds };
};

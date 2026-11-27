import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { mountRequestOf } from '../../../../../store/slices/project-mounts/mountRowModel';
import { liveMounts } from '../../../../overlap/liveMounts';
import {
  isReadyToLand,
  overlapCautionOf,
  type OverlapCaution,
} from '../../../../overlap/overlapCautionOf';
import { overlapGroupOf } from '../../../../overlap/overlapGroupOf';

type Params = {
  readonly mountId: MountId;
  readonly isSettled: boolean;
};

export const useOverlapCaution = ({ mountId, isSettled }: Params): OverlapCaution | null => {
  const subscribe = useCallback((listener: () => void) => liveMounts.subscribe({ listener }), []);
  const { mounts } = useSyncExternalStore(subscribe, liveMounts.snapshot);
  const group = useMemo(() => overlapGroupOf({ mounts, mountId }), [mounts, mountId]);
  const otherIds = useMemo(
    () =>
      group === null
        ? []
        : group.steps.filter((step) => !step.isOwn).map((step) => step.mount.mountId),
    [group],
  );
  const readyIds = useAppStore(
    useShallow((state) =>
      otherIds.filter((otherId) =>
        isReadyToLand({ request: mountRequestOf({ state, mountId: otherId }) }),
      ),
    ),
  );
  return useMemo(
    () => overlapCautionOf({ group, readyMountIds: new Set(readyIds), isSettled }),
    [group, readyIds, isSettled],
  );
};

import { useCallback } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { branchPageMountOf } from '../../branchPageMountOf';

type Params = {
  readonly sessionId: SessionId;
};

type MountParams = {
  readonly mountId: MountId;
};

export const useCanOpenBranchWork = ({ sessionId }: Params) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  return useCallback(
    ({ mountId }: MountParams): boolean => branchPageMountOf({ mounts, mountId }) !== null,
    [mounts],
  );
};

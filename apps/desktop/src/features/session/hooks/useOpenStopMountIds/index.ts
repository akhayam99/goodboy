import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useMountRows } from '../../components/SessionOverviewPane/ProjectMountRows/useMountRows';

type Params = {
  readonly sessionId: SessionId;
};

export const useOpenStopMountIds = ({ sessionId }: Params): ReadonlySet<string> | undefined => {
  const groups = useMountRows({ sessionId });
  return useMemo(() => {
    if (groups.length === 0) {
      return undefined;
    }
    return new Set(
      groups
        .flatMap((group) => group.rows)
        .filter((row) => row.isOnDisk && row.isAttached)
        .map((row) => row.mountId),
    );
  }, [groups]);
};

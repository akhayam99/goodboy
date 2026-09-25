import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  selectTurnMountCount,
  selectWritableMounts,
} from '../../../store/slices/project-mounts/selectors';
import { mountDisplayName } from '../../../store/slices/project-mounts/writeDestination';
import { agentTouchedWorktrees } from '../timeline/agentTouchedWorktrees';

const NO_TOUCHED: ReadonlyMap<string, ReadonlyArray<string>> = new Map();

export const useAgentTouchedWorktrees = (
  sessionId: SessionId,
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const spans = useAppStore((state) => state.sessionTurnSpans?.[sessionId]);
  const mountCount = useAppStore((state) => selectTurnMountCount({ state, sessionId }));
  const mountIds = useAppStore(
    useShallow((state): ReadonlyArray<MountId> =>
      selectWritableMounts({ state, sessionId }).map((mount) => mount.mountId),
    ),
  );
  const labels = useAppStore(
    useShallow((state): ReadonlyArray<string> =>
      selectWritableMounts({ state, sessionId }).map((mount) =>
        mountDisplayName({
          projectName:
            state.projects.find((project) => project.id === mount.projectId)?.name ??
            mount.mountName,
          mountName: mount.mountName,
        }),
      ),
    ),
  );
  return useMemo(() => {
    if (spans === undefined || mountCount < 2) {
      return NO_TOUCHED;
    }
    return agentTouchedWorktrees({
      spans,
      worktrees: mountIds.map((mountId, index) => ({ mountId, label: labels[index] ?? '' })),
    });
  }, [spans, mountCount, mountIds, labels]);
};

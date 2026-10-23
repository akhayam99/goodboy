import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import {
  resolveMountBaseBranch,
  selectWritableMounts,
} from '../../../store/slices/project-mounts/selectors';
import {
  readWorktreeStatusRead,
  worktreeStatusKey,
} from '../../../store/slices/worktreeStatuses/cache';
import { rebaseStopOf } from '../rebaseStopOf';
import { rebaseStopRowOf, type RebaseStopRow } from '../rebaseStopRowOf';

type Params = {
  readonly sessionId: SessionId;
};

type RowParams = {
  readonly mountId: string | null;
};

export type RebaseStopRowFor = (params: RowParams) => RebaseStopRow | null;

export const useRebaseStopRows = ({ sessionId }: Params): RebaseStopRowFor => {
  const runs = useAppStore((s) => s.historyRuns);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const settled = useAppStore((s) => s.settledRebaseStops[sessionId] ?? EMPTY_ARRAY);
  const views = useAppStore((s) => s.sessionMounts[sessionId]);
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId]);
  const projects = useAppStore((s) => s.projects);
  return useCallback(
    ({ mountId }: RowParams): RebaseStopRow | null => {
      const mount = selectWritableMounts({
        state: {
          sessionMounts: views === undefined ? {} : { [sessionId]: views },
          sessionProjectMounts: mounts === undefined ? {} : { [sessionId]: mounts },
        },
        sessionId,
      }).find((candidate) => mountId !== null && candidate.mountId === mountId);
      if (mount === undefined) {
        return null;
      }
      const baseBranch = resolveMountBaseBranch({ mount, projects });
      const stop = rebaseStopOf({
        sessionId,
        mountId: mount.mountId,
        run: runs[mount.mountId],
        events,
        settledStopIds: settled,
        baseBranch: baseBranch ?? 'main',
        read:
          mount.worktreePath === ''
            ? null
            : readWorktreeStatusRead({
                key: worktreeStatusKey({
                  worktreePath: mount.worktreePath,
                  baseBranch: baseBranch ?? undefined,
                }),
              }),
      });
      return stop === null
        ? null
        : rebaseStopRowOf({ stop, baseBranch: baseBranch ?? 'main', projectName: mount.mountName });
    },
    [events, mounts, projects, runs, sessionId, settled, views],
  );
};

import { useMemo } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import {
  readWorktreeStatusRead,
  worktreeStatusKey,
} from '../../../../store/runtime/worktreeStatuses/cache';
import { rebaseStopOf, type RebaseStop } from '../../rebaseStopOf';
import { useWorktreeTree } from '../useWorktreeTree';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly worktreePath: string | null;
};

export const useRebaseStop = ({ sessionId, mountId, worktreePath }: Params): RebaseStop | null => {
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const settled = useAppStore((s) => s.settledRebaseStops[sessionId] ?? EMPTY_ARRAY);
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const status = useWorktreeTree({ worktreePath, baseBranch });
  const readAt =
    worktreePath === null || status === null
      ? 0
      : (readWorktreeStatusRead({
          key: worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined }),
        })?.readAt ?? 0);
  return useMemo(
    () =>
      mountId === null
        ? null
        : rebaseStopOf({
            sessionId,
            mountId,
            run,
            events,
            settledStopIds: settled,
            baseBranch: baseBranch ?? 'main',
            read: status === null ? null : { status, readAt },
          }),
    [baseBranch, events, mountId, readAt, run, sessionId, settled, status],
  );
};

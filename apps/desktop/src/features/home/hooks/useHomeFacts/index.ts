import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions } from '../../../../store';
import { useUnfilteredBoardLanes } from '../../../../shared/hooks/useUnfilteredBoardLanes';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type StageCounts = Readonly<{
  needsYou: number;
  open: number;
  running: number;
  review: number;
}>;

export type HomeFacts = Readonly<{
  isLoading: boolean;
  workspaceId: WorkspaceId;
  hasSessions: boolean;
  needsYou: ReadonlyArray<Session>;
  running: ReadonlyArray<Session>;
  counts: StageCounts;
  toFinish: number;
}>;

export const useHomeFacts = ({ workspaceId }: Params): HomeFacts => {
  const sessions = useSessions();
  const lanes = useUnfilteredBoardLanes({ workspaceId, sessions });
  const { needsYou } = useNowSessions({});
  const isLoading = useAppStore(
    (state) => !state.boardReady || state.switchingToWorkspaceId != null,
  );
  return useMemo(() => {
    const running = lanes.get('running') ?? EMPTY_ARRAY;
    const counts: StageCounts = {
      needsYou: needsYou.length,
      running: running.length,
      review: (lanes.get('review') ?? EMPTY_ARRAY).length,
      open: (lanes.get('building') ?? EMPTY_ARRAY).length,
    };
    return {
      isLoading,
      workspaceId,
      hasSessions: sessions.length > 0,
      needsYou,
      running,
      counts,
      toFinish: counts.needsYou + counts.running + counts.review + counts.open,
    };
  }, [isLoading, lanes, needsYou, sessions.length, workspaceId]);
};

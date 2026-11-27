import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions, useStageGroupedSessions } from '../../../../store';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type SizeParams = {
  readonly key: string;
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
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const { needsYou, running } = useNowSessions({});
  const isLoading = useAppStore(
    (state) => !state.boardReady || state.switchingToWorkspaceId != null,
  );
  return useMemo(() => {
    const groupOf = ({ key }: SizeParams): ReadonlyArray<Session> =>
      groups.find((group) => group.key === key)?.sessions ?? EMPTY_ARRAY;
    const counted = new Set<string>(needsYou.map((session) => session.id));
    const quiet = groupOf({ key: 'attention' }).filter((session) => !counted.has(session.id));
    const counts: StageCounts = {
      needsYou: needsYou.length,
      running: running.length,
      review: groupOf({ key: 'review' }).length,
      open: groupOf({ key: 'building' }).length + quiet.length,
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
  }, [groups, isLoading, needsYou, running, sessions.length, workspaceId]);
};

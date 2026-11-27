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
  const { needsYou, running, attention } = useNowSessions({});
  const isLoading = useAppStore(
    (state) => !state.boardReady || state.switchingToWorkspaceId != null,
  );
  return useMemo(() => {
    const sizeOf = ({ key }: SizeParams): number =>
      (groups.find((group) => group.key === key)?.sessions ?? EMPTY_ARRAY).length;
    const toFinish = groups
      .filter((group) => group.key !== 'done')
      .reduce((total, group) => total + group.sessions.length, 0);
    const counts: StageCounts = {
      needsYou: attention.count,
      running: running.length,
      review: sizeOf({ key: 'review' }),
      open: Math.max(0, toFinish - attention.count - running.length - sizeOf({ key: 'review' })),
    };
    return {
      isLoading,
      workspaceId,
      hasSessions: sessions.length > 0,
      needsYou,
      running,
      counts,
      toFinish,
    };
  }, [attention.count, groups, isLoading, needsYou, running, sessions.length, workspaceId]);
};

import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSessionViewPrefs, useStageGroupedSessions } from '../../../store';
import { boardByStageOf } from '../../../store/slices/session-view/boardByStageOf';
import { stageInfosOf } from '../../../store/slices/session-view/stageInfosOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const useUnfilteredBoardLanes = ({
  workspaceId,
  sessions,
}: Params): ReadonlyMap<string, ReadonlyArray<Session>> => {
  const groups = useStageGroupedSessions(workspaceId, sessions, { isFilterIgnored: true });
  const prefs = useSessionViewPrefs(workspaceId);
  const offLanes = useMemo(() => {
    const onLanes = new Set<string>(
      groups.flatMap((group) =>
        group.key === 'attention' ? [] : group.sessions.map((session) => session.id),
      ),
    );
    return sessions.filter((session) => !onLanes.has(session.id));
  }, [groups, sessions]);
  const infos = useAppStore((state) => stageInfosOf({ state, sessions: offLanes }));
  return useMemo(() => boardByStageOf({ groups, infos, prefs }), [groups, infos, prefs]);
};

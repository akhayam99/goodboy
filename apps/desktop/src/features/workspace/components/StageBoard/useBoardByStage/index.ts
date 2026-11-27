import { useMemo } from 'react';
import type { Session, SessionStageInfo, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSessionViewPrefs } from '../../../../../store';
import { stageInfosOf } from '../../../../../store/slices/session-view/stageInfosOf';
import type { GroupedSessions } from '../../../../../store/slices/session-view/types';
import { boardByStageOf } from '../../../../../store/slices/session-view/boardByStageOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly sessions: ReadonlyArray<Session>;
};

type BoardByStage = Readonly<{
  byStage: ReadonlyMap<string, ReadonlyArray<Session>>;
  infos: Readonly<Record<string, SessionStageInfo>>;
}>;

export const useBoardByStage = ({ workspaceId, groups, sessions }: Params): BoardByStage => {
  const offLanes = useMemo(() => {
    const onLanes = new Set<string>(
      groups.flatMap((group) =>
        group.key === 'attention' ? [] : group.sessions.map((session) => session.id),
      ),
    );
    return sessions.filter((session) => !onLanes.has(session.id));
  }, [groups, sessions]);
  const infos = useAppStore((state) => stageInfosOf({ state, sessions: offLanes }));
  const prefs = useSessionViewPrefs(workspaceId);
  return useMemo(
    () => ({ byStage: boardByStageOf({ groups, infos, prefs }), infos }),
    [groups, infos, prefs],
  );
};

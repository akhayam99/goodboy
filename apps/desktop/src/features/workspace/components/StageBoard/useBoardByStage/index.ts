import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { stageInfosOf } from '../../../../../store/slices/session-view/stageInfosOf';
import type { GroupedSessions } from '../../../../../store/slices/session-view/types';
import { boardByStageOf } from '../boardByStageOf';

type Params = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly sessions: ReadonlyArray<Session>;
};

export const useBoardByStage = ({
  groups,
  sessions,
}: Params): ReadonlyMap<string, ReadonlyArray<Session>> => {
  const infos = useAppStore((state) => stageInfosOf({ state, sessions }));
  return useMemo(() => boardByStageOf({ groups, infos }), [groups, infos]);
};

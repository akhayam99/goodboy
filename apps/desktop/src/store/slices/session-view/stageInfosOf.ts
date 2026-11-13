import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { cachedStageInfoOf } from './cachedStageInfoOf';
import type { StageInfoState } from './stageInfoOf';

type InfoMap = Readonly<Record<SessionId, SessionStageInfo>>;

const maps = new WeakMap<ReadonlyArray<Session>, InfoMap>();

type Params = {
  readonly state: StageInfoState;
  readonly sessions: ReadonlyArray<Session>;
};

type CurrentParams = Params & {
  readonly map: InfoMap;
};

const isMapCurrent = ({ map, state, sessions }: CurrentParams): boolean => {
  for (const session of sessions) {
    if (map[session.id] !== cachedStageInfoOf({ state, session })) {
      return false;
    }
  }
  return true;
};

export const stageInfosOf = ({ state, sessions }: Params): InfoMap => {
  const known = maps.get(sessions);
  if (known !== undefined && isMapCurrent({ map: known, state, sessions })) {
    return known;
  }
  const infos: Record<SessionId, SessionStageInfo> = {};
  for (const session of sessions) {
    infos[session.id] = cachedStageInfoOf({ state, session });
  }
  maps.set(sessions, infos);
  return infos;
};

import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { areStageInputsSame } from './areStageInputsSame';
import { stageInfoOf, type StageInfoState } from './stageInfoOf';

type InfoMap = Readonly<Record<SessionId, SessionStageInfo>>;

type Derivation = {
  readonly inputs: StageInfoState;
  readonly infos: InfoMap;
};

const derivations = new WeakMap<ReadonlyArray<Session>, Derivation>();

type Params = {
  readonly state: StageInfoState;
};

export const stageInfosOf = ({ state }: Params): InfoMap => {
  const known = derivations.get(state.sessions);
  if (known !== undefined && areStageInputsSame({ first: known.inputs, second: state })) {
    return known.infos;
  }
  const infos: Record<SessionId, SessionStageInfo> = {};
  for (const session of state.sessions) {
    infos[session.id] = stageInfoOf(state, session);
  }
  derivations.set(state.sessions, { inputs: state, infos });
  return infos;
};

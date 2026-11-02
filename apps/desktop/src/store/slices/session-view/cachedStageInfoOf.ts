import type { Session, SessionStageInfo } from '@goodboy/types';
import { areStageInputsSame } from './areStageInputsSame';
import { stageInfoInputsOf } from './stageInfoInputsOf';
import { stageInfoOf, type StageInfoState } from './stageInfoOf';

type Derivation = {
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly info: SessionStageInfo;
};

const derivations = new WeakMap<Session, Derivation>();

type Params = {
  readonly state: StageInfoState;
  readonly session: Session;
};

export const cachedStageInfoOf = ({ state, session }: Params): SessionStageInfo => {
  const inputs = stageInfoInputsOf({ state });
  const known = derivations.get(session);
  if (known !== undefined && areStageInputsSame({ first: known.inputs, second: inputs })) {
    return known.info;
  }
  const info = stageInfoOf(state, session);
  derivations.set(session, { inputs, info });
  return info;
};

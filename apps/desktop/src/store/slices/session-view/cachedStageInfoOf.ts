import type { Session, SessionStageInfo } from '@goodboy/types';
import { countPerf } from '../../../shared/lib/countPerf';
import { PERF_COUNT_NAMES } from '../../../shared/lib/perfCountNames';
import { areStageReadsCurrent } from './areStageReadsCurrent';
import { isSameStageInfo } from './isSameStageInfo';
import { recordStageReads, type StageReads } from './recordStageReads';
import { stageInfoOf, type StageInfoState } from './stageInfoOf';

type Derivation = {
  readonly reads: StageReads | null;
  readonly info: SessionStageInfo;
};

const derivations = new WeakMap<Session, Derivation>();

type Params = {
  readonly state: StageInfoState;
  readonly session: Session;
};

export const cachedStageInfoOf = ({ state, session }: Params): SessionStageInfo => {
  const known = derivations.get(session);
  if (
    known !== undefined &&
    known.reads !== null &&
    areStageReadsCurrent({ reads: known.reads, state })
  ) {
    return known.info;
  }
  countPerf({ name: PERF_COUNT_NAMES.stageDerivations });
  countPerf({
    name: PERF_COUNT_NAMES.agentsScanned,
    amount: state.sessionPhaseRuns[session.id]?.length ?? 0,
  });
  const { value, reads } = recordStageReads({
    state,
    derive: ({ view }) => stageInfoOf(view, session),
  });
  const info =
    known !== undefined && isSameStageInfo({ first: known.info, second: value })
      ? known.info
      : value;
  derivations.set(session, { reads, info });
  return info;
};

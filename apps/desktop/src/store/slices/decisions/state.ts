import type { IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';

export type DecisionsSliceState = {
  readonly sessionDecisions: Readonly<Record<SessionId, ReadonlyArray<SessionDecision>>>;
  readonly sessionDecisionsBaseline: Readonly<Record<SessionId, IsoDateTime | null>>;
};

export const initialDecisionsState: DecisionsSliceState = {
  sessionDecisions: {},
  sessionDecisionsBaseline: {},
};

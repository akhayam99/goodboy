import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionDecisionsBaseline' | 'sessionContextSeenAt'>;
  readonly sessionId: SessionId;
};

export const selectContextBaseline = ({ state, sessionId }: Params): string | null =>
  state.sessionDecisionsBaseline[sessionId] ?? state.sessionContextSeenAt[sessionId] ?? null;

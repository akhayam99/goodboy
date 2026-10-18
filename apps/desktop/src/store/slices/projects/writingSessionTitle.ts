import type { AppState } from '../../types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'sessions'>;
  readonly holder: string | null;
};

export const writingSessionTitle = ({ state, holder }: Params): string | null => {
  if (holder === null) {
    return null;
  }
  for (const runs of Object.values(state.sessionPhaseRuns)) {
    const found = runs.find((run) => run.id === holder);
    if (found !== undefined) {
      return sessionById(state.sessions, found.sessionId)?.goal ?? null;
    }
  }
  return null;
};

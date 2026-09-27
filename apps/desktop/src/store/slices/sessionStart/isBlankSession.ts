import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<
    AppState,
    'sessions' | 'sessionPhaseRuns' | 'sessionSlots' | 'sessionProjectMounts'
  >;
  readonly sessionId: SessionId;
};

export const isBlankSession = ({ state, sessionId }: Params): boolean => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined || session.archivedAt != null) {
    return false;
  }
  return (
    session.goal.trim() === '' &&
    (session.workflowRuns ?? []).length === 0 &&
    (state.sessionPhaseRuns[sessionId] ?? []).length === 0 &&
    (state.sessionSlots[sessionId] ?? []).length === 0 &&
    (state.sessionProjectMounts[sessionId] ?? []).length === 0
  );
};

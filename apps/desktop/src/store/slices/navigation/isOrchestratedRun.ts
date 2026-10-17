import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly state: Pick<AppState, 'sessions'>;
  readonly sessionId: SessionId;
  readonly runId: string;
};

export const isOrchestratedRun = ({ state, sessionId, runId }: Params): boolean =>
  sessionById(state.sessions, sessionId)?.workflowRuns.some(
    (run) => run.id === runId && run.executionMode === 'dynamic',
  ) === true;

import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'activeLens' | 'selectedAgentId'>;
  readonly sessionId: SessionId;
};

export const isWatchingWorkflowLens = ({ state, sessionId }: Params): boolean =>
  state.activeLens?.[sessionId] === 'workflows' && state.selectedAgentId?.[sessionId] == null;

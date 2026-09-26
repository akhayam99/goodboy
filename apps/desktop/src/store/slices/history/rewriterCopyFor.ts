import type { AgentId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { HistoryRewriterBinding } from './types';

type Params = {
  readonly state: Pick<AppState, 'historyRewriters'>;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const rewriterCopyFor = ({
  state,
  sessionId,
  agentId,
}: Params): HistoryRewriterBinding | null => {
  const binding = state.historyRewriters[agentId];
  if (binding === undefined || binding.sessionId !== sessionId) {
    return null;
  }
  return binding;
};

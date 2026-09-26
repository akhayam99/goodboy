import type { AgentId, SessionId } from '@goodboy/types';
import {
  agentHomeLens,
  classifyAgent,
  resolveRootAgent,
  type AgentHomeLens,
} from '../../../features/session/agent-kind';
import type { AppState } from '../../types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const agentHomeFor = ({ state, sessionId, agentId }: Params): AgentHomeLens | null => {
  const root = resolveRootAgent({ agents: state.sessionPhaseRuns[sessionId] ?? [], agentId });
  if (root === null) {
    return null;
  }
  const override = state.agentKindOverride[root.id] ?? null;
  return agentHomeLens({ agent: root, kind: classifyAgent({ agent: root, override }) });
};

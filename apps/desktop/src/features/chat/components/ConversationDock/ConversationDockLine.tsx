import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AgentDockLine } from './AgentDockLine';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const ConversationDockLine = ({ sessionId, agentId }: Props) => {
  const agent = useAppStore((state) =>
    state.sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId),
  );
  const isAutoRoot = useAppStore(
    (state) =>
      state.autoTreeViews[sessionId]?.some((view) => view.tree.rootAgentId === agentId) === true,
  );
  if (agent === undefined || isAutoRoot) {
    return null;
  }
  return <AgentDockLine sessionId={sessionId} agent={agent} />;
};

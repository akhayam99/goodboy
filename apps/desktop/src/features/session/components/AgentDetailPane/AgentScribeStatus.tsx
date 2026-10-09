import type { Agent, AgentStatus, Session } from '@goodboy/types';
import { useScribeProposal } from '../../../../shared/hooks/useScribeProposal';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly status: AgentStatus;
};

export const AgentScribeStatus = ({ session, agent, status }: Props) => {
  const snapshot = useScribeProposal({ sessionId: session.id, agentId: agent.id });
  return <AgentStatusBadge status={snapshot?.state.kind === 'failed' ? 'failed' : status} />;
};

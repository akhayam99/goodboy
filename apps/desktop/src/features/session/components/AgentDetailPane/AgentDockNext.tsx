import type { Agent, Session } from '@goodboy/types';
import { useConversationAsks } from '../../../../store/hooks/useConversationAsks';
import { AgentDockNextRow } from './AgentDockNextRow';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

export const AgentDockNext = ({ session, agent }: Props) => {
  const { permissions, questions } = useConversationAsks({
    sessionId: session.id,
    agentId: agent.id,
  });
  if (permissions.length > 0 || questions.length > 0) {
    return null;
  }
  return <AgentDockNextRow session={session} agent={agent} />;
};

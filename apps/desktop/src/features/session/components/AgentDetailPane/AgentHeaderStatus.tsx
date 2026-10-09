import type { Agent, AgentStatus, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { classifyAgent } from '../../agent-kind';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';
import { AgentResolverStatus } from './AgentResolverStatus';
import { AgentScribeStatus } from './AgentScribeStatus';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isResolver: boolean;
  readonly status: AgentStatus;
};

export const AgentHeaderStatus = ({ session, agent, isResolver, status }: Props) => {
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  if (isResolver) {
    return <AgentResolverStatus session={session} agent={agent} status={status} />;
  }
  if (classifyAgent({ agent, override: kindOverride }) === 'scribe') {
    return <AgentScribeStatus session={session} agent={agent} status={status} />;
  }
  return <AgentStatusBadge status={status} />;
};

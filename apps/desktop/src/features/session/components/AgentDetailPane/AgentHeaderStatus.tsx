import type { Agent, AgentStatus, Session } from '@goodboy/types';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';
import { AgentResolverStatus } from './AgentResolverStatus';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isResolver: boolean;
  readonly status: AgentStatus;
};

export const AgentHeaderStatus = ({ session, agent, isResolver, status }: Props) =>
  isResolver ? (
    <AgentResolverStatus session={session} agent={agent} status={status} />
  ) : (
    <AgentStatusBadge status={status} />
  );

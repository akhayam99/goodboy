import type { AgentCardTone } from '../AgentCard/agentCardTone';
import type { ResolverStatus } from '../../resolver-linkage';

type Params = {
  readonly status: ResolverStatus;
  readonly hasUnread: boolean;
};

export const resolverCardTone = ({ status, hasUnread }: Params): AgentCardTone => {
  if (status === 'running') {
    return 'running';
  }
  if (status === 'awaiting' || hasUnread) {
    return 'attention';
  }
  if (status === 'resolved') {
    return 'success';
  }
  return 'default';
};

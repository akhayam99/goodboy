import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { autoMembershipOf, type AutoMembership } from '../autoMembershipOf';
import { useAutoTreeViews } from '../useAutoTreeViews';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const useAutoMembership = ({ sessionId, agentId }: Params): AutoMembership => {
  const views = useAutoTreeViews({ sessionId });
  return useMemo(() => autoMembershipOf({ views, agentId }), [views, agentId]);
};

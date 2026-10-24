import { AGENT_NOT_CREATED_REASON } from './agentNotCreatedReason';
import type { AutoChildState } from './autoGroupOf';

type Params = {
  readonly state: AutoChildState;
  readonly hasAgent: boolean;
  readonly reasonCode: string | null;
};

export const isAutoChildGone = ({ state, hasAgent, reasonCode }: Params): boolean => {
  if (hasAgent || state === 'neverStarted' || state === 'queued') {
    return false;
  }
  return reasonCode === null || !reasonCode.startsWith(AGENT_NOT_CREATED_REASON);
};

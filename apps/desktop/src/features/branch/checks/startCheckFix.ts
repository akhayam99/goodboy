import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectCheckChain } from '../../../store/slices/agents/selectCheckChain';
import { selectKindRouting } from '../../../store/slices/agents/selectKindRouting';

type Params = {
  readonly sessionId: SessionId;
  readonly url: string;
  readonly mountId?: MountId;
};

export const FIX_INSTRUCTION = 'Make this fix on this branch, commit it, and push nothing.';

export const startCheckFix = ({ sessionId, url, mountId }: Params): Promise<AgentId> => {
  const state = useAppStore.getState();
  const chain = selectCheckChain({ state, sessionId, url });
  if (chain.debugger === null || chain.proposal === null) {
    return Promise.reject(new Error('The proposal is no longer available. Analyze again.'));
  }
  return state.startFollowUp({
    sessionId,
    sourceAgentId: chain.debugger.id,
    kind: 'implementer',
    routing: selectKindRouting({ state, sessionId, kind: 'implementer' }),
    seed: `${chain.proposal}\n\n${FIX_INSTRUCTION}`,
    origin: { sourceKind: 'failed_check', sourceCommentUrl: url },
    focus: 'none',
    ...(mountId !== undefined && { mountId }),
  });
};

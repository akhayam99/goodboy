import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectCheckChain } from '../../../store/slices/agents/selectCheckChain';
import { selectKindRouting } from '../../../store/slices/agents/selectKindRouting';
import { checkAnalysisOf } from './checkAnalysisOf';

type Params = {
  readonly sessionId: SessionId;
  readonly url: string;
  readonly mountId: MountId;
  readonly optionKey?: string;
};

const FIX_INSTRUCTION = 'Make this fix on this branch, commit it, and push nothing.';
const NO_EVENTS = [] as const;

export const startCheckFix = ({ sessionId, url, mountId, optionKey }: Params): Promise<AgentId> => {
  const state = useAppStore.getState();
  const chain = selectCheckChain({ state, sessionId, url });
  if (chain.debugger === null || chain.proposal === null) {
    return Promise.reject(new Error('The proposal is no longer available. Analyze again.'));
  }
  const { finding, options } = checkAnalysisOf({
    agent: chain.debugger,
    events: state.transcripts[chain.debugger.id] ?? NO_EVENTS,
  });
  const chosen =
    options === null
      ? undefined
      : (options.options.find((option) => option.key === optionKey) ??
        options.options.find((option) => option.key === options.recommendedKey) ??
        options.options[0]);
  const fix =
    chosen === undefined
      ? chain.proposal
      : `Option ${chosen.key}: ${chosen.title}\n\n${chosen.body}`;
  const seed =
    finding.length === 0
      ? `${fix}\n\n${FIX_INSTRUCTION}`
      : `Finding:\n${finding}\n\nFix:\n${fix}\n\n${FIX_INSTRUCTION}`;
  return state.startFollowUp({
    sessionId,
    sourceAgentId: chain.debugger.id,
    kind: 'implementer',
    routing: selectKindRouting({ state, sessionId, kind: 'implementer' }),
    seed,
    origin: { sourceKind: 'failed_check', sourceCommentUrl: url },
    focus: 'none',
    mountId,
  });
};

import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { CheckChain } from '../../../store/slices/agents/selectCheckChain';
import { ItemAgentVerbs } from '../../live-state/itemWork/ItemAgentVerbs';
import { ItemWorkLine } from '../../live-state/itemWork/ItemWorkLine';
import { agentStepPhraseOf } from '../../live-state/itemWork/agentStepPhraseOf';
import type { ItemWorkState } from '../../live-state/itemWork/itemWorkWords';

type Props = {
  readonly sessionId: SessionId;
  readonly chain: CheckChain;
  readonly state: ItemWorkState;
};

type LiveParams = Pick<Props, 'chain' | 'state'>;

const liveAgentOf = ({ chain, state }: LiveParams) => {
  if (state === 'analyzing') {
    return chain.debugger;
  }
  if (state === 'fixing') {
    return chain.fix;
  }
  return null;
};

export const AnalyzedCheckWork = ({ sessionId, chain, state }: Props) => {
  const agentId = liveAgentOf({ chain, state })?.id ?? null;
  const step = useAppStore((store) => {
    if (agentId === null) {
      return null;
    }
    const transcript = store.transcripts[agentId];
    return transcript === undefined ? null : agentStepPhraseOf({ transcript });
  });
  const isAgentWaiting = useAppStore(
    (store) => agentId !== null && store.agentTurnState[agentId]?.kind === 'blocked',
  );
  return (
    <ItemWorkLine
      state={state}
      detail={step}
      agentId={agentId}
      isAgentWaiting={isAgentWaiting}
      verbs={agentId === null ? null : <ItemAgentVerbs sessionId={sessionId} agentId={agentId} />}
    />
  );
};

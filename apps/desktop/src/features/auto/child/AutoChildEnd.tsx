import type { AutoDelegation } from '@goodboy/db';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { TailLine } from '../../live-state/TailLine';
import { autoChildLive } from '../../live-state/adapters/autoChildLive';
import type { TailActionId, TailFacts } from '../../live-state/tailFacts';
import { DelegationResult } from '../chat/DelegationResult';
import type { DelegationCardModel } from '../chat/delegationCardOf';

type Props = {
  readonly sessionId: SessionId;
  readonly delegation: AutoDelegation;
  readonly card: DelegationCardModel;
  readonly agent: Agent;
};

const RETURNED: TailFacts = {
  state: 'idle',
  phrase: 'Returned to Auto',
  startedAt: null,
  actions: [],
};

export const AutoChildEnd = ({ sessionId, delegation, card, agent }: Props) => {
  const turn = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const cancelCurrentTurn = useAppStore((state) => state.cancelCurrentTurn);
  if (turn?.kind === 'running' || turn?.kind === 'starting') {
    return null;
  }
  const live = autoChildLive({ delegation, turn, agent, lastTool: null, project: null });
  const facts = live ?? (delegation.state === 'settled' ? RETURNED : null);
  const handlers: Partial<Record<TailActionId, () => void>> = {
    retryThroughAuto: () => void continueStoppedAgent({ sessionId, agentId: agent.id }),
    stopAgent: () => void cancelCurrentTurn(sessionId, agent.id, 'user'),
  };

  return (
    <div data-auto-child-end="" className="flex min-w-0 flex-col gap-3">
      {card.result === null ? null : <DelegationResult result={card.result} />}
      {facts === null ? null : (
        <div role="status" aria-live="polite">
          <TailLine facts={facts} onAction={(id) => handlers[id]?.()} />
        </div>
      )}
    </div>
  );
};

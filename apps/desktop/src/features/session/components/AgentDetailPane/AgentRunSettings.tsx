import type { RefCallback } from 'react';
import type { Agent, Session } from '@goodboy/types';
import type { useAutoChat } from '../../../auto/chat/useAutoChat';
import { autoLimitOpenEvent } from '../../../auto/chat/autoLimitOpenEvent';
import { useAgentSpend } from '../../hooks/useAgentSpend';
import { spendTextOf } from '../../glance/spendTextOf';
import { useConversationGlance } from '../../../../store/hooks/useConversationGlance';
import { AgentRunRoute } from '../RunRoute/AgentRunRoute';
import { AgentSettingsLine } from '../AgentSettingsLine';
import { RunGlanceLine } from '../RunGlanceLine';

type AutoView = NonNullable<ReturnType<typeof useAutoChat>['tree']>['view'];

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly autoView: AutoView | null;
  readonly asksSlotRef: RefCallback<HTMLElement>;
  readonly modelsSlotRef: RefCallback<HTMLElement>;
};

export const AgentRunSettings = ({
  session,
  agent,
  autoView,
  asksSlotRef,
  modelsSlotRef,
}: Props) => {
  const agentSpendUsd = useAgentSpend({ sessionId: session.id, agentId: agent.id });
  const line = (
    <AgentSettingsLine
      session={session}
      kind={<AgentRunRoute session={session} agentId={agent.id} />}
      auto={
        autoView === null || autoView.budget === null
          ? null
          : { treeId: autoView.tree.id, facts: autoView.budget }
      }
      asksSlotRef={asksSlotRef}
      modelsSlotRef={modelsSlotRef}
    />
  );
  const budget = autoView?.budget ?? null;
  const glance = useConversationGlance({ sessionId: session.id, agent, autoView });
  return (
    <RunGlanceLine
      id={agent.id}
      glance={{ ...glance, sentence: '' }}
      spend={spendTextOf({ spentUsd: budget === null ? agentSpendUsd : budget.spentUsd })}
      settings={line}
      revealEvent={autoView === null ? undefined : autoLimitOpenEvent({ treeId: autoView.tree.id })}
    />
  );
};

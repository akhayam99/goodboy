import type { RefCallback } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { useAutoChat } from '../../../auto/chat/useAutoChat';
import { autoGlanceOf } from '../../../auto/glance/autoGlanceOf';
import { isAutoDockSpeaking } from '../../../auto/glance/isAutoDockSpeaking';
import { agentGlanceOf } from '../../glance/agentGlanceOf';
import { useAgentSpend } from '../../hooks/useAgentSpend';
import { spendTextOf } from '../../glance/spendTextOf';
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
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
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
  const glance =
    autoView === null
      ? agentGlanceOf({ agent, turnState })
      : autoGlanceOf({ view: autoView, rootTurn: turnState });
  const isDockSpeaking =
    autoView !== null && isAutoDockSpeaking({ view: autoView, rootTurn: turnState });
  return (
    <RunGlanceLine
      id={agent.id}
      glance={isDockSpeaking ? { ...glance, sentence: '' } : glance}
      spend={spendTextOf({ spentUsd: budget === null ? agentSpendUsd : budget.spentUsd })}
      settings={line}
    />
  );
};

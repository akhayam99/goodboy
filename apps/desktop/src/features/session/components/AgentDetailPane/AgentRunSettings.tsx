import type { RefCallback } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore, useSessionCost } from '../../../../store';
import type { useAutoChat } from '../../../auto/chat/useAutoChat';
import { autoGlanceOf } from '../../../auto/glance/autoGlanceOf';
import { agentGlanceOf } from '../../glance/agentGlanceOf';
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
  const sessionCapUsd = useAppStore(
    (state) => state.sessionBudgets[session.id]?.softCapUsd ?? null,
  );
  const sessionSpentUsd = useSessionCost(session.id);
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
  return (
    <RunGlanceLine
      id={agent.id}
      glance={
        autoView === null
          ? agentGlanceOf({ agent, turnState })
          : autoGlanceOf({ view: autoView, rootTurn: turnState })
      }
      spend={
        budget === null
          ? spendTextOf({ spentUsd: sessionSpentUsd, capUsd: sessionCapUsd })
          : spendTextOf({ spentUsd: budget.spentUsd, capUsd: budget.capUsd })
      }
      settings={line}
    />
  );
};

import { useMemo, type ReactNode, type RefCallback } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { autoChildStatusOf } from '../../../auto/autoChildStatusOf';
import { delegationGlanceOf } from '../../glance/delegationGlanceOf';
import type { useAutoChat } from '../../../auto/chat/useAutoChat';
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
  readonly isInHead?: boolean;
  readonly trailing?: ReactNode;
  readonly state?: ReactNode;
};

export const AgentRunSettings = ({
  session,
  agent,
  autoView,
  asksSlotRef,
  isInHead = false,
  trailing = null,
  state = null,
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
    />
  );
  const budget = autoView?.budget ?? null;
  const conversationGlance = useConversationGlance({ sessionId: session.id, agent, autoView });
  const views = useAppStore((state) => state.autoTreeViews[session.id]);
  const childStatus = useMemo(
    () => (autoView === null ? autoChildStatusOf({ views, agent }) : null),
    [autoView, views, agent],
  );
  const glance =
    childStatus === null ? conversationGlance : delegationGlanceOf({ status: childStatus });
  return (
    <RunGlanceLine
      glance={{ ...glance, sentence: '' }}
      spend={spendTextOf({ spentUsd: budget === null ? agentSpendUsd : budget.spentUsd })}
      settings={line}
      isInHead={isInHead}
      trailing={trailing}
      leading={state}
      isStateShown={state === null}
    />
  );
};

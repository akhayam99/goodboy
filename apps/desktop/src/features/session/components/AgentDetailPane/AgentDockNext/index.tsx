import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useConversationAsks } from '../../../../../store/hooks/useConversationAsks';
import { useNow } from '../../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../../auto/autoRetryTargetsOf';
import { useNextCards } from '../../../central/next/useNextCards';
import { useSessionWorkModel } from '../../../central/useSessionWorkModel';
import { dockNextOf } from '../dockNextOf';
import { AgentDockNextRow } from './AgentDockNextRow';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

const AUTO_CLOCK_MS = 15_000;

export const AgentDockNext = ({ session, agent }: Props) => {
  const { permissions, questions } = useConversationAsks({
    sessionId: session.id,
    agentId: agent.id,
  });
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, model.autoTrees.length > 0);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, openFor } = useNextCards({ session, model, autoTargets });
  if (permissions.length > 0 || questions.length > 0) {
    return null;
  }
  const next = dockNextOf({
    cards,
    agentId: agent.id,
    canOpen: ({ card }) => openFor({ card }) !== null,
  });
  const open = next === null ? null : openFor({ card: next.card });
  if (next === null || open === null) {
    return null;
  }
  return <AgentDockNextRow next={next} onOpen={open} />;
};

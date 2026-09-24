import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { isTurnStateLive } from '../agent-lifecycle';

type Params = {
  readonly sessionId: SessionId;
};

export type AgentLifecycleSignals = {
  readonly openQuestionAgentIds: ReadonlySet<AgentId>;
  readonly liveTurnAgentIds: ReadonlySet<AgentId>;
};

export const useAgentLifecycleSignals = ({ sessionId }: Params): AgentLifecycleSignals => {
  const askingIds = useAppStore(
    useShallow((state) =>
      (state.sessionOpenQuestions[sessionId] ?? []).flatMap((question) =>
        question.status === 'open' && question.createdByAgentId != null
          ? [question.createdByAgentId]
          : [],
      ),
    ),
  );
  const liveIds = useAppStore(
    useShallow((state) =>
      (state.sessionPhaseRuns[sessionId] ?? []).flatMap((agent) =>
        isTurnStateLive({ turnState: state.agentTurnState[agent.id] }) ? [agent.id] : [],
      ),
    ),
  );
  return useMemo(
    () => ({
      openQuestionAgentIds: new Set(askingIds),
      liveTurnAgentIds: new Set(liveIds),
    }),
    [askingIds, liveIds],
  );
};

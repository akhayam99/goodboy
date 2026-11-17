import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, SessionId, TurnState } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { useLiveAgentTurns } from '../../../../shared/hooks/useLiveAgentTurns';
import { autoRootsOf } from '../../../auto/autoRootsOf';
import { commentRunAgentsOf } from '../../commentRunAgentsOf';
import { commentRunViewsFrom } from '../../commentRunViewsFrom';
import type { CommentRunView } from '../../commentRunViewsOf';

type Params = {
  readonly sessionId: SessionId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_AUTO_VIEWS: ReadonlyArray<AutoTreeView> = [];

export const useCommentRuns = ({ sessionId }: Params): ReadonlyMap<string, CommentRunView> => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const runAgents = useMemo(() => commentRunAgentsOf({ agents }), [agents]);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const autoViews = useAppStore((state) => state.autoTreeViews[sessionId] ?? NO_AUTO_VIEWS);
  const questions = useSessionOpenQuestions(sessionId);
  const turnByAgentId = useLiveAgentTurns({ agents: runAgents });
  const rootTurns = useAppStore(
    useShallow((state) => {
      const turns: Record<string, TurnState | undefined> = {};
      for (const root of autoRootsOf({
        agents: runAgents,
        kindOverride: state.agentKindOverride,
      })) {
        turns[root.id] = state.agentTurnState[root.id];
      }
      return turns;
    }),
  );
  return useMemo(
    () =>
      commentRunViewsFrom({
        runAgents,
        kindOverride,
        autoViews,
        questions,
        rootTurns,
        turnByAgentId,
      }),
    [autoViews, kindOverride, questions, rootTurns, runAgents, turnByAgentId],
  );
};

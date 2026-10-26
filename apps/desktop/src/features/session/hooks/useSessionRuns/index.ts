import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, Session, TurnState } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { autoRootsOf } from '../../../auto/autoRootsOf';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { sessionRunsOf, type SessionRun } from '../../sessionRunsOf';
import { useLiveAgentTurns } from '../../../../shared/hooks/useLiveAgentTurns';

type Params = {
  readonly session: Session;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_AUTO_VIEWS: ReadonlyArray<AutoTreeView> = [];

export const useSessionRuns = ({ session }: Params): ReadonlyArray<SessionRun> => {
  const sessionId = session.id;
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const autoViews = useAppStore((state) => state.autoTreeViews[sessionId] ?? NO_AUTO_VIEWS);
  const orchestrating = useAppStore((state) => state.orchestratingWorkflowRuns);
  const questions = useSessionOpenQuestions(sessionId);
  const turnByAgentId = useLiveAgentTurns({ agents });
  const rootTurns = useAppStore(
    useShallow((state) => {
      const turns: Record<string, TurnState | undefined> = {};
      for (const root of autoRootsOf({
        agents: state.sessionPhaseRuns[sessionId] ?? NO_AGENTS,
        kindOverride: state.agentKindOverride,
      })) {
        turns[root.id] = state.agentTurnState[root.id];
      }
      return turns;
    }),
  );
  return useMemo(
    () =>
      sessionRunsOf({
        attachedRuns,
        agents,
        kindOverride,
        autoViews,
        orchestrating,
        questions,
        rootTurns,
        turnByAgentId,
      }),
    [
      attachedRuns,
      agents,
      kindOverride,
      autoViews,
      orchestrating,
      questions,
      rootTurns,
      turnByAgentId,
    ],
  );
};

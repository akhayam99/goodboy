import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, SessionId, TurnState } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { useLiveAgentTurns } from '../../../../shared/hooks/useLiveAgentTurns';
import { autoRootsOf } from '../../../auto/autoRootsOf';
import { descendantAgentsOf } from '../../../session/descendantAgentsOf';
import { sessionRunsOf } from '../../../session/sessionRunsOf';
import { commentRunViewsOf, type CommentRunView } from '../../commentRunViewsOf';

type Params = {
  readonly sessionId: SessionId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_AUTO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const NO_VIEWS: ReadonlyMap<string, CommentRunView> = new Map();

const NO_RECORD: Readonly<Record<string, never>> = {};

type AgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const commentRunAgentsOf = ({ agents }: AgentsParams): ReadonlyArray<Agent> => {
  const roots = agents.filter(
    (agent) => agent.deletedAt == null && agent.sourceKind === 'comment_run',
  );
  if (roots.length === 0) {
    return NO_AGENTS;
  }
  return roots.flatMap((root) => [root, ...descendantAgentsOf({ agents, rootId: root.id })]);
};

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
  return useMemo(() => {
    if (runAgents.length === 0) {
      return NO_VIEWS;
    }
    const runs = sessionRunsOf({
      attachedRuns: [],
      agents: runAgents,
      kindOverride,
      autoViews,
      orchestrating: undefined,
      questions,
      rootTurns,
      turnByAgentId,
      revisingStarts: NO_RECORD,
      mounts: [],
      projects: [],
    });
    return commentRunViewsOf({ agents: runAgents, runs });
  }, [autoViews, kindOverride, questions, rootTurns, runAgents, turnByAgentId]);
};

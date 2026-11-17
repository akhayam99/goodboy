import type { Agent, SessionId, TurnState } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { autoRootsOf } from '../auto/autoRootsOf';
import { commentRunAgentsOf } from './commentRunAgentsOf';
import { commentRunViewsFrom } from './commentRunViewsFrom';
import type { CommentRunView } from './commentRunViewsOf';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const LIVE_TURNS: ReadonlySet<TurnState['kind']> = new Set(['running', 'blocked']);

export const commentRunViewOfStore = ({
  state,
  sessionId,
  threadId,
}: Params): CommentRunView | null => {
  const runAgents = commentRunAgentsOf({ agents: state.sessionPhaseRuns[sessionId] ?? NO_AGENTS });
  if (runAgents.length === 0) {
    return null;
  }
  const turnByAgentId = new Map<string, TurnState>();
  for (const agent of runAgents) {
    const turn = state.agentTurnState[agent.id];
    if (turn !== undefined && LIVE_TURNS.has(turn.kind)) {
      turnByAgentId.set(agent.id, turn);
    }
  }
  const rootTurns: Record<string, TurnState | undefined> = {};
  for (const root of autoRootsOf({ agents: runAgents, kindOverride: state.agentKindOverride })) {
    rootTurns[root.id] = state.agentTurnState[root.id];
  }
  return (
    commentRunViewsFrom({
      runAgents,
      kindOverride: state.agentKindOverride,
      autoViews: state.autoTreeViews[sessionId] ?? [],
      questions: state.sessionOpenQuestions[sessionId] ?? [],
      rootTurns,
      turnByAgentId,
    }).get(threadId) ?? null
  );
};

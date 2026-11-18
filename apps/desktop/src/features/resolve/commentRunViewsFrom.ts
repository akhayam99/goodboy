import type { Agent, OpenQuestion, TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import type { AgentKind } from '../session/agent-kind';
import { sessionRunsOf } from '../session/sessionRunsOf';
import { commentRunViewsOf, type CommentRunView } from './commentRunViewsOf';

type Params = {
  readonly runAgents: ReadonlyArray<Agent>;
  readonly kindOverride: Readonly<Record<string, AgentKind>>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly rootTurns: Readonly<Record<string, TurnState | undefined>>;
  readonly turnByAgentId: ReadonlyMap<string, TurnState>;
};

const NO_VIEWS: ReadonlyMap<string, CommentRunView> = new Map();

const NO_RECORD: Readonly<Record<string, never>> = {};

export const commentRunViewsFrom = ({
  runAgents,
  kindOverride,
  autoViews,
  questions,
  rootTurns,
  turnByAgentId,
}: Params): ReadonlyMap<string, CommentRunView> => {
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
};

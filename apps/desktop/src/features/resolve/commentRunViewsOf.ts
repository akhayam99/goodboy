import type { Agent, AgentId, MountId } from '@goodboy/types';
import type { DotState } from '@goodboy/ui';
import { agentThreadIds } from '../session/agentThreadIds';
import type { SessionRun } from '../session/sessionRunsOf';
import { commentRunOf } from './commentRunOf';

export type CommentRunView = {
  readonly agentId: AgentId;
  readonly title: string;
  readonly stateWord: string;
  readonly dot: DotState;
  readonly isFinished: boolean;
  readonly mountId: MountId | null;
  readonly threadIds: ReadonlyArray<string>;
};

type RunRow = Pick<SessionRun, 'open' | 'title' | 'stateWord' | 'dot' | 'isFinished'>;

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly runs: ReadonlyArray<RunRow>;
};

export const commentRunViewsOf = ({
  agents,
  runs,
}: Params): ReadonlyMap<string, CommentRunView> => {
  const views = new Map<string, CommentRunView>();
  const linked = agents.filter(
    (agent) => agent.deletedAt == null && agent.sourceKind === 'comment_run',
  );
  for (const agent of linked) {
    const run = runs.find(
      (candidate) => candidate.open.kind !== 'run' && candidate.open.agentId === agent.id,
    );
    if (run === undefined) {
      continue;
    }
    const threadIds = [...new Set(agentThreadIds(agent))];
    const view: CommentRunView = {
      agentId: agent.id,
      title: run.title,
      stateWord: run.stateWord,
      dot: run.dot,
      isFinished: run.isFinished,
      mountId: agent.mountId ?? null,
      threadIds,
    };
    for (const threadId of threadIds) {
      if (commentRunOf({ agents, threadId }) === agent.id) {
        views.set(threadId, view);
      }
    }
  }
  return views;
};

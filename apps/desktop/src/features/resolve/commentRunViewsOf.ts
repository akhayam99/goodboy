import type { Agent, AgentId, MountId } from '@goodboy/types';
import type { DotState } from '@goodboy/ui';
import { agentThreadIds } from '../session/agentThreadIds';
import type { SessionRun } from '../session/sessionRunsOf';
import { commentRunOf } from './commentRunOf';
import { holdsCommentThreads } from './holdsCommentThreads';

export type CommentRunEnd = 'working' | 'finished' | 'stopped';

export type CommentRunView = {
  readonly agentId: AgentId;
  readonly title: string;
  readonly stateWord: string;
  readonly dot: DotState;
  readonly end: CommentRunEnd;
  readonly summary: string | null;
  readonly mountId: MountId | null;
  readonly threadIds: ReadonlyArray<string>;
};

type RunRow = Pick<SessionRun, 'open' | 'title' | 'stateWord' | 'dot' | 'isFinished'>;

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly runs: ReadonlyArray<RunRow>;
};

const STOPPED_DOTS: ReadonlySet<DotState> = new Set<DotState>(['stopped', 'failed']);

type EndParams = {
  readonly agent: Agent;
  readonly run: RunRow;
};

const runEndOf = ({ agent, run }: EndParams): CommentRunEnd => {
  if (agent.status === 'stopped' || agent.status === 'failed' || STOPPED_DOTS.has(run.dot)) {
    return 'stopped';
  }
  return run.isFinished || agent.status === 'completed' ? 'finished' : 'working';
};

type SummaryParams = {
  readonly agent: Agent;
};

const leadSummaryOf = ({ agent }: SummaryParams): string | null => {
  const summary = agent.outputSummary?.trim() ?? '';
  return summary === '' ? null : summary;
};

export const commentRunViewsOf = ({
  agents,
  runs,
}: Params): ReadonlyMap<string, CommentRunView> => {
  const views = new Map<string, CommentRunView>();
  const stopped = new Map<string, CommentRunView>();
  const linked = agents
    .filter((agent) => agent.deletedAt == null && holdsCommentThreads({ agent }))
    .sort((left, right) => left.ordinal - right.ordinal);
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
      end: runEndOf({ agent, run }),
      summary: leadSummaryOf({ agent }),
      mountId: agent.mountId ?? null,
      threadIds,
    };
    for (const threadId of threadIds) {
      if (commentRunOf({ agents, threadId }) === agent.id) {
        views.set(threadId, view);
        continue;
      }
      if (view.end === 'stopped') {
        stopped.set(threadId, view);
      }
    }
  }
  for (const [threadId, view] of stopped) {
    if (!views.has(threadId)) {
      views.set(threadId, view);
    }
  }
  return views;
};

import type { AgentId, PullRequestState, SessionId } from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
import type { AgentKindRouting } from '../session/agent-kind';
import { contextWindowFor } from '../session/contextWindowFor';
import {
  fixAttemptChunks,
  startFixAttempt,
  type SetAgentConfigFn,
  type SpawnAgentFn,
} from '../review/startFixAttempt';

type Params = {
  readonly sessionId: SessionId;
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState;
  readonly routing: AgentKindRouting;
  readonly note?: string;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

type CountParams = {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState;
  readonly routing: AgentKindRouting;
  readonly note?: string;
};

export const resolveAgentCount = ({ threads, pr, routing, note = '' }: CountParams): number =>
  fixAttemptChunks({
    threads,
    mode: 'shared',
    pr,
    hint: note.trim(),
    contextWindow: contextWindowFor(routing.model),
  }).length;

export const startResolve = ({
  sessionId,
  threads,
  pr,
  routing,
  note = '',
  spawnAgent,
  setAgentConfig,
}: Params): Promise<ReadonlyArray<AgentId>> =>
  startFixAttempt({
    sessionId,
    threads,
    pr,
    choice: { provider: routing.provider, model: routing.model, effort: routing.effort },
    instructions: note,
    mode: 'shared',
    contextWindow: contextWindowFor(routing.model),
    spawnAgent,
    setAgentConfig,
  });

import type {
  AgentId,
  PullRequestState,
  ReplyVoice,
  ResolveCommitStyle,
  SessionId,
} from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
import type { AgentKindRouting } from '../session/agent-kind';
import { contextWindowFor } from '../session/contextWindowFor';
import {
  fixAttemptChunks,
  startFixAttempt,
  type SetAgentConfigFn,
  type SpawnAgentFn,
} from '../review/startFixAttempt';
import { resolveFixupTargets } from './resolveFixupTargets';

export type ResolveStartStyle = {
  readonly commitStyle: ResolveCommitStyle;
  readonly voice: ReplyVoice;
  readonly styleNote: string | null;
  readonly worktreePath: string | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState;
  readonly routing: AgentKindRouting;
  readonly note?: string;
  readonly style?: ResolveStartStyle;
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

export const startResolve = async ({
  sessionId,
  threads,
  pr,
  routing,
  note = '',
  style,
  spawnAgent,
  setAgentConfig,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const worktreePath = style?.worktreePath ?? null;
  const fixupTargets =
    style?.commitStyle === 'fixup' && worktreePath !== null
      ? await resolveFixupTargets({ worktreePath, threads })
      : [];
  return startFixAttempt({
    sessionId,
    threads,
    pr,
    choice: { provider: routing.provider, model: routing.model, effort: routing.effort },
    instructions: note,
    mode: 'shared',
    ...(style !== undefined && {
      style: {
        commitStyle: style.commitStyle,
        fixupTargets,
        voice: style.voice,
        styleNote: style.styleNote,
      },
    }),
    contextWindow: contextWindowFor(routing.model),
    spawnAgent,
    setAgentConfig,
  });
};

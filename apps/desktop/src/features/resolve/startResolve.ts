import type {
  AgentId,
  PullRequestState,
  ReplyVoice,
  ResolveCommitStyle,
  SessionId,
} from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
import type { PriorContext } from '../chat/spawn-from-comment';
import type { AgentKindRouting } from '../session/agent-kind';
import { contextWindowFor } from '../session/contextWindowFor';
import {
  startFixAttempt,
  type FixMode,
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
  readonly pr: PullRequestState | null;
  readonly routing: AgentKindRouting;
  readonly note?: string;
  readonly mode?: FixMode;
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolveStartStyle;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

export const startResolve = async ({
  sessionId,
  threads,
  pr,
  routing,
  note = '',
  mode = 'shared',
  priorContext,
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
    mode,
    ...(priorContext !== undefined && { priorContext }),
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

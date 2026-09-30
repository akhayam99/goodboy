import type {
  AgentId,
  PullRequestState,
  ReplyVoice,
  ResolveCommitStyle,
  SessionId,
} from '@goodboy/types';
import type { CommentThread } from '../integrations/github/comment-threads';
import type { PriorContext } from '../chat/spawn-from-comment';
import type { AgentKindRouting } from '../session/agent-kind';
import { contextWindowFor } from '../session/contextWindowFor';
import {
  startFixAttempt,
  type FixMode,
  type SetAgentConfigFn,
  type SpawnAgentFn,
} from '../review/startFixAttempt';
import type { ResolveAttemptBatch } from '../../store/slices/resolve/types';
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
  readonly batch?: ResolveAttemptBatch | null;
  readonly routing?: AgentKindRouting;
  readonly note?: string;
  readonly mode?: FixMode;
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolveStartStyle;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

const contextWindowOf = ({
  batch,
  routing,
}: {
  readonly batch: ResolveAttemptBatch | null;
  readonly routing: AgentKindRouting | undefined;
}): number | null => {
  const model = batch?.launchChoice.model ?? routing?.model ?? null;
  return model === null ? null : contextWindowFor(model);
};

export const startResolve = async ({
  sessionId,
  threads,
  pr,
  batch = null,
  routing,
  note = '',
  mode = 'separate',
  priorContext,
  style,
  spawnAgent,
  setAgentConfig,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const worktreePath = style?.worktreePath ?? null;
  const commitStyle = batch?.launchChoice.commitStyle ?? style?.commitStyle ?? 'new';
  const fixupTargets =
    commitStyle === 'fixup' && worktreePath !== null
      ? await resolveFixupTargets({ worktreePath, threads })
      : [];
  return startFixAttempt({
    sessionId,
    threads,
    pr,
    mode,
    ...(routing !== undefined && {
      choice: { provider: routing.provider, model: routing.model, effort: routing.effort },
    }),
    instructions: note,
    ...(priorContext !== undefined && { priorContext }),
    style: {
      commitStyle,
      fixupTargets,
      ...(style !== undefined && { voice: style.voice, styleNote: style.styleNote }),
    },
    contextWindow: contextWindowOf({ batch, routing }),
    batch:
      batch === null ? null : { ...batch, launchChoice: { ...batch.launchChoice, commitStyle } },
    spawnAgent,
    setAgentConfig,
  });
};

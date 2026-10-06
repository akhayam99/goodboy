import type { PullRequestState, ReplyVoice, ResolveCommitStyle, SessionId } from '@goodboy/types';
import type { CommentThread } from '../integrations/github/comment-threads';
import type { PriorContext } from '../chat/spawn-from-comment';
import { contextWindowFor } from '../session/contextWindowFor';
import {
  startFixAttempt,
  type SetAgentConfigFn,
  type SpawnAgentFn,
  type StartedFix,
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
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolveStartStyle;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

const contextWindowOf = ({ batch }: { readonly batch: ResolveAttemptBatch | null }) => {
  const model = batch?.launchChoice.model ?? null;
  return model === null ? null : contextWindowFor(model);
};

export const startResolve = async ({
  sessionId,
  threads,
  pr,
  batch = null,
  priorContext,
  style,
  spawnAgent,
  setAgentConfig,
}: Params): Promise<StartedFix> => {
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
    ...(priorContext !== undefined && { priorContext }),
    style: {
      commitStyle,
      fixupTargets,
      ...(style !== undefined && { voice: style.voice, styleNote: style.styleNote }),
    },
    contextWindow: contextWindowOf({ batch }),
    batch:
      batch === null ? null : { ...batch, launchChoice: { ...batch.launchChoice, commitStyle } },
    spawnAgent,
    setAgentConfig,
  });
};

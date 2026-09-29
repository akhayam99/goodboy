import type {
  AgentId,
  PullRequestState,
  ReplyVoice,
  ResolveCommitStyle,
  SessionId,
} from '@goodboy/types';
import type { CommentThread } from '../github/comment-threads';
import { contextWindowFor } from '../session/contextWindowFor';
import {
  startFixAttempt,
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
  readonly batch: ResolveAttemptBatch;
  readonly style?: ResolveStartStyle;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

export const startResolve = async ({
  sessionId,
  threads,
  pr,
  batch,
  style,
  spawnAgent,
  setAgentConfig,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const worktreePath = style?.worktreePath ?? null;
  const commitStyle = batch.launchChoice.commitStyle ?? style?.commitStyle ?? 'new';
  const fixupTargets =
    commitStyle === 'fixup' && worktreePath !== null
      ? await resolveFixupTargets({ worktreePath, threads })
      : [];
  return startFixAttempt({
    sessionId,
    threads,
    pr,
    mode: 'separate',
    style: {
      commitStyle,
      fixupTargets,
      ...(style !== undefined && { voice: style.voice, styleNote: style.styleNote }),
    },
    contextWindow:
      batch.launchChoice.model === null ? null : contextWindowFor(batch.launchChoice.model),
    batch: { ...batch, launchChoice: { ...batch.launchChoice, commitStyle } },
    spawnAgent,
    setAgentConfig,
  });
};

import type { AgentId, PullRequestState, SessionId, EffortLevel } from '@goodboy/types';
import {
  buildResolverAgentArgs,
  buildResolverKickoff,
  type PriorContext,
  type ResolveModelChoice,
  type ResolverStyle,
} from '../chat/spawn-from-comment';
import type { CommentThread } from '../integrations/github/comment-threads';
import { modelChoiceOfLaunch } from '../resolve/launchChoice';
import { dropLaunchTurns, queueLaunchTurns } from '../../store/slices/resolve/launchTurns';
import type { ResolveAttemptBatch, ResolveAttemptLaunch } from '../../store/slices/resolve/types';
import { chunkConversations } from './chunkConversations';

type SpawnAgentArgs = {
  readonly name: string;
  readonly model?: string;
  readonly provider?: ResolveModelChoice['provider'];
  readonly effort?: EffortLevel;
  readonly initialPrompt: string;
  readonly humanPrompt: string;
  readonly kindOverride: 'resolver' | 'scout';
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl: string;
  readonly sourceKind: 'review_comment' | 'comment_recheck';
  readonly focus: 'none';
  readonly parentAgentId?: AgentId;
  readonly resolveBatch?: ResolveAttemptBatch;
  readonly resolveLaunch?: ResolveAttemptLaunch;
};

export type SpawnAgentFn = (sessionId: SessionId, args: SpawnAgentArgs) => Promise<AgentId>;

export type SetAgentConfigFn = (
  sessionId: SessionId,
  agentId: AgentId,
  fields: {
    readonly providerOverride?: ResolveModelChoice['provider'];
    readonly modelOverride?: string;
    readonly effort?: EffortLevel;
  },
) => Promise<void>;

type Params = {
  readonly sessionId: SessionId;
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState | null;
  readonly choice?: ResolveModelChoice;
  readonly instructions?: string | null;
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolverStyle;
  readonly contextWindow?: number | null;
  readonly batch?: ResolveAttemptBatch | null;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

export type StartedFix = {
  readonly launchId: string;
  readonly agentId: AgentId;
};

const joinHints = ({ hints }: { readonly hints: ReadonlyArray<string | null | undefined> }) =>
  hints
    .map((hint) => (hint ?? '').trim())
    .filter((hint) => hint.length > 0)
    .join('\n\n');

export const startFixAttempt = async ({
  sessionId,
  threads,
  pr,
  choice: requested = {},
  instructions,
  priorContext,
  style: requestedStyle,
  contextWindow = null,
  batch = null,
  spawnAgent,
  setAgentConfig,
}: Params): Promise<StartedFix> => {
  if (threads.length === 0) {
    throw new Error('A fix run needs at least one comment');
  }
  const launched =
    batch === null ? null : modelChoiceOfLaunch({ launchChoice: batch.launchChoice });
  const choice = launched ?? requested;
  const commitStyle = batch?.launchChoice.commitStyle ?? null;
  const style = commitStyle === null ? requestedStyle : { ...requestedStyle, commitStyle };
  const hint =
    launched === null
      ? (instructions ?? choice.hint ?? '').trim()
      : joinHints({ hints: [launched.hint, instructions] });
  const resolveLaunch: ResolveAttemptLaunch = { launchId: crypto.randomUUID() };
  const chunks = chunkConversations({
    threads,
    contextWindow,
    measurePrompt: ({ threads: candidate }) =>
      buildResolverKickoff({ threads: candidate, pr, hint }).length,
  });
  const [first = threads, ...later] = chunks;
  const scopedTo = ({ chunk }: { readonly chunk: ReadonlyArray<CommentThread> }) => {
    const owned = new Set(
      chunk.flatMap((thread) => (thread.head.threadId == null ? [] : [thread.head.threadId])),
    );
    return priorContext?.filter((entry) => owned.has(entry.threadId)) ?? [];
  };
  const scoped = scopedTo({ chunk: first });
  const args = buildResolverAgentArgs({
    threads: first,
    pr,
    hint,
    ...(scoped.length > 0 && { priorContext: scoped }),
    ...(style !== undefined && { style }),
  });
  queueLaunchTurns({
    launchId: resolveLaunch.launchId,
    turns: later.map((chunk) => {
      const turnScoped = scopedTo({ chunk });
      return {
        threadIds: chunk.flatMap((thread) =>
          thread.head.threadId == null ? [] : [thread.head.threadId],
        ),
        content: buildResolverKickoff({
          threads: chunk,
          pr,
          hint,
          ...(turnScoped.length > 0 && { priorContext: turnScoped }),
          ...(style !== undefined && { style }),
        }),
      };
    }),
  });
  try {
    const agentId = await spawnAgent(sessionId, {
      name: threads.length > 1 ? `Resolve: ${threads.length} review comments` : args.name,
      ...(choice.model !== undefined && { model: choice.model }),
      ...(choice.provider !== undefined && { provider: choice.provider }),
      ...(choice.effort !== undefined && { effort: choice.effort }),
      initialPrompt: args.initialPrompt,
      humanPrompt: args.humanPrompt,
      kindOverride: 'resolver',
      ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
      sourceCommentUrl: args.sourceCommentUrl,
      sourceKind: 'review_comment',
      focus: 'none',
      ...(batch !== null && { resolveBatch: batch }),
      resolveLaunch,
    });
    await setAgentConfig(sessionId, agentId, {
      ...(choice.provider !== undefined && { providerOverride: choice.provider }),
      ...(choice.model !== undefined && { modelOverride: choice.model }),
      ...(choice.effort !== undefined && { effort: choice.effort }),
    });
    return { launchId: resolveLaunch.launchId, agentId };
  } catch (error) {
    dropLaunchTurns({ launchId: resolveLaunch.launchId });
    throw error;
  }
};

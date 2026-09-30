import type { AgentId, PullRequestState, SessionId, EffortLevel } from '@goodboy/types';
import {
  buildRecheckAgentArgs,
  buildResolverAgentArgs,
  buildResolverKickoff,
  type PriorContext,
  type ResolveModelChoice,
  type ResolverStyle,
} from '../chat/spawn-from-comment';
import type { CommentThread } from '../github/comment-threads';
import { chunkConversations } from './chunkConversations';
import { modelChoiceOfLaunch } from '../resolve/launchChoice';
import type { ResolveAttemptBatch } from '../../store/slices/resolve/types';

export type FixMode = 'shared' | 'separate' | 'retry' | 'recheck' | 'proceed';

type SpawnAgentArgs = {
  readonly name: string;
  readonly model?: string;
  readonly provider?: ResolveModelChoice['provider'];
  readonly effort?: EffortLevel;
  readonly initialPrompt: string;
  readonly kindOverride: 'resolver' | 'scout';
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl: string;
  readonly sourceKind: 'review_comment' | 'comment_recheck';
  readonly focus: 'none';
  readonly resolveBatch?: ResolveAttemptBatch;
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
  readonly mode: FixMode;
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolverStyle;
  readonly contextWindow?: number | null;
  readonly batch?: ResolveAttemptBatch | null;
  readonly spawnAgent: SpawnAgentFn;
  readonly setAgentConfig: SetAgentConfigFn;
};

const fixAttemptChunks = ({
  threads,
  mode,
  pr,
  hint,
  contextWindow,
}: {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly mode: FixMode;
  readonly pr: PullRequestState | null;
  readonly hint: string;
  readonly contextWindow: number | null;
}): ReadonlyArray<ReadonlyArray<CommentThread>> => {
  if (mode === 'separate' || mode === 'recheck') {
    return threads.map((thread) => [thread]);
  }
  return chunkConversations({
    threads,
    contextWindow,
    measurePrompt: ({ threads: candidate }) =>
      buildResolverKickoff({ threads: candidate, pr, hint }).length,
  });
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
  mode,
  priorContext,
  style: requestedStyle,
  contextWindow = null,
  batch = null,
  spawnAgent,
  setAgentConfig,
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const launched =
    batch === null ? null : modelChoiceOfLaunch({ launchChoice: batch.launchChoice });
  const choice = launched ?? requested;
  const commitStyle = batch?.launchChoice.commitStyle ?? null;
  const style = commitStyle === null ? requestedStyle : { ...requestedStyle, commitStyle };
  const hint =
    launched === null
      ? (instructions ?? choice.hint ?? '').trim()
      : joinHints({ hints: [launched.hint, instructions] });
  const chunks = fixAttemptChunks({ threads, mode, pr, hint, contextWindow });
  const agentIds: Array<AgentId> = [];
  for (const chunk of chunks) {
    const owned = new Set(
      chunk.flatMap((thread) => (thread.head.threadId == null ? [] : [thread.head.threadId])),
    );
    const scoped = priorContext?.filter((entry) => owned.has(entry.threadId)) ?? [];
    const first = chunk[0];
    const args =
      mode === 'recheck' && first !== undefined
        ? buildRecheckAgentArgs({
            thread: first,
            pr,
            hint,
            ...(scoped.length > 0 && { priorContext: scoped }),
          })
        : buildResolverAgentArgs({
            threads: chunk,
            pr,
            hint,
            ...(scoped.length > 0 && { priorContext: scoped }),
            ...(style !== undefined && { style }),
          });
    const agentId = await spawnAgent(sessionId, {
      name: args.name,
      ...(choice.model !== undefined && { model: choice.model }),
      ...(choice.provider !== undefined && { provider: choice.provider }),
      ...(choice.effort !== undefined && { effort: choice.effort }),
      initialPrompt: args.initialPrompt,
      kindOverride: mode === 'recheck' ? 'scout' : 'resolver',
      ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
      sourceCommentUrl: args.sourceCommentUrl,
      sourceKind: args.sourceKind === 'comment_recheck' ? 'comment_recheck' : 'review_comment',
      focus: 'none',
      ...(batch !== null && { resolveBatch: batch }),
    });
    await setAgentConfig(sessionId, agentId, {
      ...(choice.provider !== undefined && { providerOverride: choice.provider }),
      ...(choice.model !== undefined && { modelOverride: choice.model }),
      ...(choice.effort !== undefined && { effort: choice.effort }),
    });
    agentIds.push(agentId);
  }
  return agentIds;
};

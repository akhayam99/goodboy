import { buildHandoff } from '@goodboy/core';
import type {
  Agent,
  AgentHandoff,
  AgentId,
  HandoffSender,
  IsoDateTime,
  PrComment,
  ProviderRunId,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import {
  buildRecheckKickoff,
  buildResolverKickoff,
} from '../../../../features/chat/spawn-from-comment';
import { RESOLVE_SCENE_PR } from './resolveSeed';

const MINUTE = 60_000;
const LIVE_THREAD = 'PRRT_thread_retry_backoff';

export type ResolverFlow = 'resolve' | 'recheck' | 'follow-up';

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

const comment = (): PrComment => ({
  id: 'mock-brief-live-comment',
  author: 'Mara Quint',
  authorAvatarUrl: null,
  body: "This retries forever on a 429 without any cap, and it keeps hammering the provider after a Retry-After response. Please cap the attempts, back off exponentially, and honor the provider's delay.",
  createdAt: isoAgo({ minutes: 12 }),
  url: `${RESOLVE_SCENE_PR.url}#discussion_${LIVE_THREAD}`,
  source: 'review',
  path: 'src/webhooks/retryPolicy.ts',
  line: 42,
  resolved: false,
  outdated: false,
  threadId: LIVE_THREAD,
});

const kickoffOf = ({ flow }: { readonly flow: ResolverFlow }): string => {
  const thread = { head: comment(), replies: [] };
  if (flow === 'recheck') {
    return buildRecheckKickoff({
      thread,
      pr: RESOLVE_SCENE_PR,
      hint: 'Confirm whether the retry cap is still on this branch.',
    });
  }
  if (flow === 'follow-up') {
    return 'Follow up on the retry review. Explain which delay wins when Retry-After exceeds the configured cap, and keep the answer tied to the existing resolver work.';
  }
  return buildResolverKickoff({
    threads: [thread],
    pr: RESOLVE_SCENE_PR,
    hint: 'Keep the existing retry metrics and add coverage for the capped delay.',
  });
};

const senderOf = ({
  flow,
  agentId,
}: {
  readonly flow: ResolverFlow;
  readonly agentId: AgentId;
}): HandoffSender => {
  if (flow === 'follow-up') {
    return { kind: 'followUp', sourceAgentId: agentId };
  }
  return { kind: 'resolve', threadIds: [LIVE_THREAD], prNumber: RESOLVE_SCENE_PR.number };
};

type LiveParams = {
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
};

export const liveAgent = ({
  agent,
  flow,
}: {
  readonly agent: Agent;
  readonly flow: ResolverFlow;
}): Agent => ({
  ...agent,
  status: 'running',
  completedAt: undefined,
  sourceKind: flow === 'recheck' ? 'comment_recheck' : 'review_comment',
  sourceThreadIds: [LIVE_THREAD],
});

export const liveTurnState = ({ runId }: { readonly runId: ProviderRunId }): TurnState => ({
  kind: 'running',
  runId,
  startedAt: isoAgo({ minutes: 0.6 }),
});

export const liveHandoff = ({
  agentId,
  flow,
}: {
  readonly agentId: AgentId;
  readonly flow: ResolverFlow;
}): AgentHandoff => {
  const kickoff = kickoffOf({ flow });
  const liveComment = comment();
  return buildHandoff({
    agentId,
    provider: 'anthropic',
    createdAt: isoAgo({ minutes: 0.6 }),
    sender: senderOf({ flow, agentId }),
    instruction: kickoff,
    why: null,
    doneWhen: null,
    goal: 'Resolve reviewer feedback on the webhook retry backoff PR',
    earlierSteps: [],
    plan: null,
    files: [],
    threads: [
      {
        threadId: LIVE_THREAD,
        author: liveComment.author,
        location: 'src/webhooks/retryPolicy.ts:42',
        link: liveComment.url,
        body: liveComment.body,
      },
    ],
    scopeSummary: 'Writes payments-api',
    rules: [
      {
        label: 'Projects',
        text: 'You may change payments-api. Leave every other project as it is.',
      },
    ],
    profile: 'You resolve review comments with the smallest change that answers them.',
    role: {
      label: 'Resolver',
      instructions: 'Change only what the comment asks for, then reply with the required markers.',
      isEdited: false,
    },
    sent: { system: null, message: kickoff },
  });
};

export const liveTranscript = ({
  agentId,
  runId,
  flow,
}: LiveParams & { readonly flow: ResolverFlow }): ReadonlyArray<TurnEvent> => {
  const kickoff = kickoffOf({ flow });
  return [
    {
      kind: 'user_text',
      runId,
      text: kickoff,
      handoffId: agentId,
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      at: isoAgo({ minutes: 0.6 }),
    },
  ];
};

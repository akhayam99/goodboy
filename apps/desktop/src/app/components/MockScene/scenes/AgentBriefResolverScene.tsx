import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  ResolveAttempt,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { SESSION, SESSION_ID, seedResolveScene } from './resolveSeed';
import { WorkspaceFrame } from './audit/WorkspaceFrame';
import { sceneParam } from './audit/sceneParams';
import {
  liveAgent,
  liveHandoff,
  liveTranscript,
  liveTurnState,
  type ResolverFlow,
} from './agentBriefResolverLive';

const SINGLE_ID = 'mock-brief-resolver-single' as AgentId;
const BATCH_A_ID = 'mock-brief-resolver-batch-a' as AgentId;
const BATCH_B_ID = 'mock-brief-resolver-batch-b' as AgentId;
const BATCH_ID = 'mock-brief-resolve-batch';
const SINGLE_THREAD = 'PRRT_thread_retry_backoff';
const SINGLE_ITEM = 'mock-resolve-item-retry-backoff';
const BATCH_THREADS = ['PRRT_thread_typo', 'PRRT_thread_retry_constant'] as const;
const MINUTE = 60_000;
const AUTHORS: Readonly<Record<string, string>> = {
  [SINGLE_THREAD]: 'Mara Quint',
  [BATCH_THREADS[0]]: 'Theo Varga',
  [BATCH_THREADS[1]]: 'Mara Quint',
};

const runIdOf = (agentId: AgentId): ProviderRunId => `${agentId}-run` as ProviderRunId;

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

const resolverAgent = ({
  id,
  ordinal,
  name,
  minutes,
  summary,
}: {
  readonly id: AgentId;
  readonly ordinal: number;
  readonly name: string;
  readonly minutes: number;
  readonly summary: string;
}): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal,
  name,
  kind: 'resolver',
  status: 'completed',
  runId: runIdOf(id),
  startedAt: isoAgo({ minutes: minutes + 4 }),
  completedAt: isoAgo({ minutes }),
  outputSummary: summary,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5',
});

const attemptOf = ({
  id,
  agentId,
  threadId,
  minutes,
  batchId,
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly threadId: string;
  readonly minutes: number;
  readonly batchId: string | null;
}): ResolveAttempt => ({
  id,
  sessionId: SESSION_ID,
  agentId,
  prNumber: 318,
  threadIds: [threadId],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: Date.now() - (minutes + 4) * MINUTE,
  endedAt: Date.now() - minutes * MINUTE,
  error: null,
  createdAt: Date.now() - (minutes + 4) * MINUTE,
  batchId,
  copyPath: null,
  launchChoice: null,
});

const transcriptOf = (agentId: AgentId): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: runIdOf(agentId),
    text: 'Resolve the review comment on retryPolicy.ts.',
    at: isoAgo({ minutes: 12 }),
  },
  {
    kind: 'assistant_text',
    runId: runIdOf(agentId),
    delta: 'Capped the loop and added jitter to every delay.',
    at: isoAgo({ minutes: 9 }),
  },
];

const AGENTS: ReadonlyArray<Agent> = [
  resolverAgent({
    id: SINGLE_ID,
    ordinal: 40,
    name: 'resolve: Mara Quint on retryPolicy.ts:42',
    minutes: 9,
    summary: 'Capped the retry loop and added jitter.',
  }),
  resolverAgent({
    id: BATCH_A_ID,
    ordinal: 41,
    name: 'resolve: Theo Varga on config.ts:3',
    minutes: 8,
    summary: 'Fixed the typo in the retry comment.',
  }),
  resolverAgent({
    id: BATCH_B_ID,
    ordinal: 42,
    name: 'resolve: Mara Quint on retryPolicy.ts:12',
    minutes: 8,
    summary: 'Named the retry constant.',
  }),
];

const SHORT_SHA = 'c81e5aa';

const stagePush = (): void => {
  const state = useAppStore.getState();
  const queue = (state.sessionResolveQueueItems[SESSION_ID] ?? []).map((entry) =>
    entry.item.id === SINGLE_ITEM
      ? {
          item: { ...entry.item, approvalState: 'accepted' as const, approvedRevision: 1 },
          thread: {
            ...entry.thread,
            stage: 'approved' as const,
            commitShas: [`${SHORT_SHA}aaaa`],
          },
        }
      : entry,
  );
  const preview = {
    publicationId: 'mock-brief-publication',
    repo: 'harborline/payments-api',
    prNumber: 318,
    branch: 'hl/fix-duplicate-credit',
    localHead: `${SHORT_SHA}aaaa`,
    remoteHead: '7d02b11bbbb',
    requiresPush: true,
    frozenAt: 1,
    earlierCommits:
      sceneParam({ key: 'earlier' }) === '1'
        ? [
            {
              sha: '3b7d10eaaaa',
              shortSha: '3b7d10e',
              subject: 'Rename the delivery row helper',
              author: 'resolver',
              timestamp: 1,
              pushed: false,
              parentSha: null,
            },
            {
              sha: '91fa2c4aaaa',
              shortSha: '91fa2c4',
              subject: 'Log the redelivery count',
              author: 'resolver',
              timestamp: 1,
              pushed: false,
              parentSha: null,
            },
          ]
        : [],
    commits: [
      {
        sha: `${SHORT_SHA}aaaa`,
        shortSha: SHORT_SHA,
        subject: 'Stop retrying forever on a 429',
        author: 'resolver',
        timestamp: 1,
        pushed: false,
        parentSha: null,
        threadIds: [SINGLE_THREAD],
      },
    ],
    unapproved: [],
    replies: [{ threadId: SINGLE_THREAD, body: 'Fixed.', revision: 1, closes: true }],
    notes: [],
    excluded: [],
    drift: [],
    blocker: null,
  };
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: queue },
    preparePublication: async () => preview,
    publishConversations: async () => ({
      kind: 'done' as const,
      pushed: true,
      pushedHead: `${SHORT_SHA}aaaa`,
      total: 1,
      replies: 1,
      replied: 1,
      closed: 1,
      resolved: 1,
      leftOpen: 0,
      failed: 0,
      error: null,
    }),
  });
};

export const AgentBriefResolverScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { navigate } = useAppStore.getState();
    seedResolveScene({ expandedThreadId: null });
    const isLive = sceneParam({ key: 'live' }) === '1';
    const flowParam = sceneParam({ key: 'flow' });
    const flow: ResolverFlow =
      flowParam === 'recheck' || flowParam === 'follow-up' ? flowParam : 'resolve';
    const agents = isLive
      ? AGENTS.map((agent) => (agent.id === SINGLE_ID ? liveAgent({ agent, flow }) : agent))
      : AGENTS;
    const state = useAppStore.getState();
    const candidates = (state.sessionResolveCandidates[SESSION_ID] ?? []).map((entry) => ({
      ...entry,
      items: entry.items.filter((item) => item.queueItemId === SINGLE_ITEM),
    }));
    const github = state.sessionGithub[SESSION_ID];
    const detail = github?.detail ?? null;
    const sessionGithub =
      github === undefined || detail === null
        ? state.sessionGithub
        : {
            ...state.sessionGithub,
            [SESSION_ID]: {
              ...github,
              detail: {
                ...detail,
                comments: detail.comments.map((comment) => ({
                  ...comment,
                  author: AUTHORS[comment.threadId ?? ''] ?? comment.author,
                })),
              },
            },
          };
    useAppStore.setState({
      navigate,
      detectedEditors: [],
      loadDetectedEditors: async () => undefined,
      sessionGithub,
      selectedAgentId: {},
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: null },
      sessionResolveCandidates: { [SESSION_ID]: candidates },
      sessionPhaseRuns: { [SESSION_ID]: agents },
      sessionResolveAttempts: {
        [SESSION_ID]: [
          attemptOf({
            id: 'mock-brief-attempt-single',
            agentId: SINGLE_ID,
            threadId: SINGLE_THREAD,
            minutes: 9,
            batchId: null,
          }),
          attemptOf({
            id: 'mock-brief-attempt-batch-a',
            agentId: BATCH_A_ID,
            threadId: BATCH_THREADS[0],
            minutes: 8,
            batchId: BATCH_ID,
          }),
          attemptOf({
            id: 'mock-brief-attempt-batch-b',
            agentId: BATCH_B_ID,
            threadId: BATCH_THREADS[1],
            minutes: 8,
            batchId: BATCH_ID,
          }),
        ],
      },
      agentTurnState: Object.fromEntries(
        AGENTS.map((agent) => [
          agent.id,
          isLive && agent.id === SINGLE_ID
            ? liveTurnState({ runId: runIdOf(agent.id) })
            : ({ kind: 'ended', endedAt: isoAgo({ minutes: 8 }) } satisfies TurnState),
        ]),
      ),
      transcripts: Object.fromEntries(
        AGENTS.map((agent) => [
          agent.id,
          isLive && agent.id === SINGLE_ID
            ? liveTranscript({ agentId: agent.id, runId: runIdOf(agent.id), flow })
            : transcriptOf(agent.id),
        ]),
      ),
      agentRunHistory: Object.fromEntries(AGENTS.map((agent) => [agent.id, [runIdOf(agent.id)]])),
    });
    if (isLive) {
      useAppStore.setState({
        agentHandoffs: { [SINGLE_ID]: liveHandoff({ agentId: SINGLE_ID, flow }) },
        loadAgentHandoff: async () => undefined,
      });
    }
    if (sceneParam({ key: 'state' }) === 'accepted') {
      stagePush();
    }
    const open = sceneParam({ key: 'open' });
    const target = open === 'batch' ? BATCH_A_ID : open === 'single' || isLive ? SINGLE_ID : null;
    const pane = sceneParam({ key: 'pane' }) === 'transcript' ? 'transcript' : 'brief';
    if (target !== null) {
      navigate({ to: agentPlace({ sessionId: SESSION_ID, agentId: target, pane }) });
    }
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <WorkspaceFrame session={SESSION} />;
};

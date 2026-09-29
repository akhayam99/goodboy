import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  ResolveAttempt,
  ResolveQueueItem,
  ResolveQueueItemWithThread,
  ResolveStage,
  ResolveThread,
  ResolveThreadState,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NOW, SESSION, seedActivityRunScene } from './activityRunSeed';

export const ACTIVITY_RESOLVES_SESSION = SESSION;

const PR_NUMBER = 318;
const BATCH_ID = 'mock-batch-pr-318';
const NOW_MS = Date.parse(NOW);

type Kind = 'ready' | 'drafting' | 'pushed' | 'failed';

type ResolveSeed = {
  readonly author: string;
  readonly file: string;
  readonly kind: Kind;
};

const SEEDS: ReadonlyArray<ResolveSeed> = [
  { author: 'mquint', file: 'retryPolicy.ts:42', kind: 'ready' },
  { author: 'tvarga', file: 'config.ts:18', kind: 'drafting' },
  { author: 'iokafor', file: 'idempotency.ts:77', kind: 'pushed' },
  { author: 'mquint', file: 'metrics.ts:9', kind: 'drafting' },
  { author: 'tvarga', file: 'errorShape.ts:31', kind: 'ready' },
  { author: 'mquint', file: 'logging.ts:64', kind: 'failed' },
  { author: 'iokafor', file: 'timeoutConfig.ts:12', kind: 'drafting' },
  { author: 'tvarga', file: 'retryPolicy.ts:88', kind: 'ready' },
  { author: 'mquint', file: 'idempotency.ts:20', kind: 'pushed' },
  { author: 'iokafor', file: 'config.ts:51', kind: 'drafting' },
];

const STAGE: Record<Kind, ResolveStage> = {
  ready: 'proposed',
  drafting: 'working',
  pushed: 'resolved',
  failed: 'failed',
};

const THREAD_STATE: Record<Kind, ResolveThreadState> = {
  ready: 'fixed',
  drafting: 'working',
  pushed: 'closed',
  failed: 'failed',
};

const AGENT_STATUS: Record<Kind, Agent['status']> = {
  ready: 'completed',
  drafting: 'running',
  pushed: 'completed',
  failed: 'failed',
};

const ATTEMPT_PHASE: Record<Kind, ResolveAttempt['phase']> = {
  ready: 'finished',
  drafting: 'running',
  pushed: 'finished',
  failed: 'failed',
};

const isoOf = ({ minutesAgo }: { readonly minutesAgo: number }): IsoDateTime =>
  new Date(NOW_MS - minutesAgo * 60_000).toISOString() as IsoDateTime;

const agentIdOf = ({ index }: { readonly index: number }): AgentId =>
  `mock-resolves-agent-${index}` as AgentId;

const buildAgent = ({
  seed,
  index,
}: {
  readonly seed: ResolveSeed;
  readonly index: number;
}): Agent => {
  const minutesAgo = index + 1;
  const isRunning = seed.kind === 'drafting';
  return {
    id: agentIdOf({ index }),
    sessionId: SESSION.id,
    ordinal: 100 - index,
    name: `resolve: ${seed.author} on ${seed.file}`,
    kind: 'resolver',
    status: AGENT_STATUS[seed.kind],
    runId: `mock-resolves-run-${index}` as ProviderRunId,
    startedAt: isoOf({ minutesAgo: minutesAgo + 1 }),
    ...(isRunning
      ? {}
      : {
          completedAt: isoOf({ minutesAgo }),
          lastFinishedAt: isoOf({ minutesAgo }),
        }),
    lastViewedAt: NOW,
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5',
  };
};

const buildThread = ({
  seed,
  index,
}: {
  readonly seed: ResolveSeed;
  readonly index: number;
}): ResolveThread => ({
  id: `mock-resolves-thread-row-${index}`,
  sessionId: SESSION.id,
  projectId: null,
  prNumber: PR_NUMBER,
  threadId: `PRRT_mock_resolves_${index}`,
  originKind: 'review_comment',
  diffCommentId: null,
  state: THREAD_STATE[seed.kind],
  stage: STAGE[seed.kind],
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: `mock-resolves-attempt-${index}`,
  disposition: seed.kind === 'drafting' ? null : 'fix',
  replyDraft: seed.kind === 'drafting' ? null : 'Capped the retry backoff and read Retry-After.',
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: NOW_MS - (index + 12) * 60_000,
  updatedAt: NOW_MS - (index + 1) * 60_000,
});

const buildItem = ({
  seed,
  thread,
  index,
}: {
  readonly seed: ResolveSeed;
  readonly thread: ResolveThread;
  readonly index: number;
}): ResolveQueueItem => ({
  id: `mock-resolves-item-${index}`,
  sessionId: SESSION.id,
  threadId: thread.threadId,
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 1,
  approvalState: 'none',
  approvedRevision: null,
  approvedReplyHash: null,
  integratedSha: seed.kind === 'pushed' ? `abc${index}def` : null,
  deferredAt: null,
  deliveredAt: seed.kind === 'pushed' ? NOW_MS - 60_000 : null,
  supersededAt: null,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
});

const buildAttempt = ({
  seed,
  thread,
  index,
}: {
  readonly seed: ResolveSeed;
  readonly thread: ResolveThread;
  readonly index: number;
}): ResolveAttempt => ({
  id: `mock-resolves-attempt-${index}`,
  sessionId: SESSION.id,
  agentId: agentIdOf({ index }),
  prNumber: PR_NUMBER,
  threadIds: [thread.threadId],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: ATTEMPT_PHASE[seed.kind],
  mountTarget: null,
  startedAt: NOW_MS - (index + 2) * 60_000,
  endedAt: seed.kind === 'drafting' ? null : NOW_MS - (index + 1) * 60_000,
  error: seed.kind === 'failed' ? 'The draft stopped before it produced a change.' : null,
  createdAt: NOW_MS - (index + 2) * 60_000,
  batchId: BATCH_ID,
  copyPath: null,
  launchChoice: null,
});

export const seedActivityResolvesScene = (): void => {
  seedActivityRunScene();
  const state = useAppStore.getState();
  const agents = SEEDS.map((seed, index) => buildAgent({ seed, index }));
  const threads = SEEDS.map((seed, index) => buildThread({ seed, index }));
  const items: ReadonlyArray<ResolveQueueItemWithThread> = SEEDS.map((seed, index) => {
    const thread = threads[index];
    if (thread === undefined) {
      throw new Error('resolve thread missing');
    }
    return { item: buildItem({ seed, thread, index }), thread };
  });
  const attempts = SEEDS.map((seed, index) => {
    const thread = threads[index];
    if (thread === undefined) {
      throw new Error('resolve thread missing');
    }
    return buildAttempt({ seed, thread, index });
  });
  useAppStore.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION.id]: [...agents, ...(state.sessionPhaseRuns[SESSION.id] ?? [])],
    },
    sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [SESSION.id]: items },
    sessionResolveAttempts: { ...state.sessionResolveAttempts, [SESSION.id]: attempts },
    sessionResolvePublications: { ...state.sessionResolvePublications, [SESSION.id]: [] },
    loadResolveSession: async () => undefined,
    agentTurnState: {
      ...state.agentTurnState,
      ...Object.fromEntries(
        SEEDS.flatMap((seed, index) =>
          seed.kind === 'drafting'
            ? [
                [
                  agentIdOf({ index }),
                  {
                    kind: 'running',
                    runId: `mock-resolves-run-${index}` as ProviderRunId,
                    startedAt: isoOf({ minutesAgo: index + 2 }),
                  },
                ] as const,
              ]
            : [],
        ),
      ),
    },
    selectedAgentId: {},
  });
};

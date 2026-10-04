import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  MountId,
  ProviderRunId,
  ReportArtifact,
  ResolveAttempt,
  ResolveQueueItem,
  ResolveQueueItemWithThread,
  ResolveStage,
  ResolveThread,
  ResolveThreadState,
  SessionEvent,
  SessionEventId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NOW, SESSION, seedActivityRunScene } from './activityRunSeed';

export const ACTIVITY_RESOLVES_SESSION = SESSION;

const PR_NUMBER = 318;
const BATCH_ID = 'mock-batch-pr-318';
const RETRY_LAUNCH_ID = 'mock-launch-retry-pr-318';
const NOW_MS = Date.parse(NOW);

type Kind = 'ready' | 'drafting' | 'pushed' | 'failed';

type ResolveSeed = {
  readonly author: string;
  readonly file: string;
  readonly kind: Kind;
  readonly origin?: 'legacy' | 'retry';
  readonly minutesBack?: number;
};

const LEGACY_BACK = 26 * 60;
const MOUNT_TARGET = {
  mountId: 'mock-mount-payments-api' as MountId,
  mountRevision: 1,
  worktreePath: '/Users/dev/harborline/payments-api',
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
  { author: 'mquint', file: 'logging.ts:64', kind: 'ready', origin: 'retry' },
  {
    author: 'tvarga',
    file: 'ledger.ts:4',
    kind: 'pushed',
    origin: 'legacy',
    minutesBack: LEGACY_BACK,
  },
  {
    author: 'tvarga',
    file: 'ledger.ts:18',
    kind: 'pushed',
    origin: 'legacy',
    minutesBack: LEGACY_BACK + 2,
  },
  {
    author: 'iokafor',
    file: 'rounding.ts:31',
    kind: 'pushed',
    origin: 'legacy',
    minutesBack: LEGACY_BACK + 4,
  },
  {
    author: 'mquint',
    file: 'rounding.ts:8',
    kind: 'failed',
    origin: 'legacy',
    minutesBack: LEGACY_BACK + 5,
  },
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
  const minutesAgo = index + 1 + (seed.minutesBack ?? 0);
  const isRunning = seed.kind === 'drafting';
  return {
    id: agentIdOf({ index }),
    sessionId: SESSION.id,
    ordinal: 100 - index,
    name: `Resolve: ${seed.author} on ${seed.file}`,
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

type SubagentSeed = {
  readonly kind: 'scout' | 'implementer' | 'tester';
  readonly name: string;
  readonly status: Agent['status'];
  readonly startedMinutesAgo: number;
  readonly endedMinutesAgo: number | null;
};

const IMPLEMENTER_ID = 'mock-resolves-agent-implementer' as AgentId;

const SUBAGENT_SEEDS: ReadonlyArray<SubagentSeed> = [
  {
    kind: 'scout',
    name: 'Scout current retry paths',
    status: 'completed',
    startedMinutesAgo: 34,
    endedMinutesAgo: 33,
  },
  {
    kind: 'scout',
    name: 'Scout banner placement in the console',
    status: 'completed',
    startedMinutesAgo: 33,
    endedMinutesAgo: 32,
  },
  {
    kind: 'scout',
    name: 'Scout stuck-delivery thresholds',
    status: 'completed',
    startedMinutesAgo: 32,
    endedMinutesAgo: 31,
  },
  {
    kind: 'implementer',
    name: 'Implement the banner component',
    status: 'completed',
    startedMinutesAgo: 30,
    endedMinutesAgo: 27,
  },
  {
    kind: 'implementer',
    name: 'Implement the stuck threshold hook',
    status: 'completed',
    startedMinutesAgo: 29,
    endedMinutesAgo: 27,
  },
  {
    kind: 'tester',
    name: 'Test stuck-delivery banner states',
    status: 'running',
    startedMinutesAgo: 26,
    endedMinutesAgo: null,
  },
];

const subagentIdOf = ({ index }: { readonly index: number }): AgentId =>
  `mock-resolves-agent-subagent-${index}` as AgentId;

const buildImplementer = (): Agent => ({
  id: IMPLEMENTER_ID,
  sessionId: SESSION.id,
  ordinal: 10,
  name: 'Implement the stuck-delivery banner',
  kind: 'implementer',
  status: 'running',
  runId: 'mock-resolves-run-implementer' as ProviderRunId,
  startedAt: isoOf({ minutesAgo: 36 }),
  lastViewedAt: NOW,
  providerOverride: 'cursor',
  modelOverride: 'kimi-k3',
});

const buildSubagent = ({
  seed,
  index,
}: {
  readonly seed: SubagentSeed;
  readonly index: number;
}): Agent => ({
  id: subagentIdOf({ index }),
  sessionId: SESSION.id,
  parentAgentId: IMPLEMENTER_ID,
  ordinal: 11 + index,
  name: seed.name,
  kind: seed.kind,
  status: seed.status,
  runId: `mock-resolves-run-subagent-${index}` as ProviderRunId,
  startedAt: isoOf({ minutesAgo: seed.startedMinutesAgo }),
  ...(seed.endedMinutesAgo === null
    ? {}
    : {
        completedAt: isoOf({ minutesAgo: seed.endedMinutesAgo }),
        lastFinishedAt: isoOf({ minutesAgo: seed.endedMinutesAgo }),
      }),
  lastViewedAt: NOW,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5',
});

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
}): ResolveAttempt => {
  const back = (seed.minutesBack ?? 0) * 60_000;
  return {
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
    mountTarget: MOUNT_TARGET,
    startedAt: NOW_MS - (index + 2) * 60_000 - back,
    endedAt: seed.kind === 'drafting' ? null : NOW_MS - (index + 1) * 60_000 - back,
    error: seed.kind === 'failed' ? 'The draft stopped before it produced a change.' : null,
    createdAt: NOW_MS - (index + 2) * 60_000 - back,
    batchId: seed.origin === 'legacy' ? null : BATCH_ID,
    launchId: seed.origin === 'retry' ? RETRY_LAUNCH_ID : null,
    retryOfLaunchId: seed.origin === 'retry' ? BATCH_ID : null,
    copyPath: null,
    launchChoice: null,
  };
};

const CONTEXT_EVENTS: ReadonlyArray<SessionEvent> = [
  {
    id: 'mock-resolves-event-context-retry' as SessionEventId,
    sessionId: SESSION.id,
    kind: 'decisions_changed',
    payload: { added: 1, replaced: 2 },
    createdAt: isoOf({ minutesAgo: 34 }),
  },
  {
    id: 'mock-resolves-event-context-logging' as SessionEventId,
    sessionId: SESSION.id,
    kind: 'decisions_changed',
    payload: { replaced: 2 },
    createdAt: isoOf({ minutesAgo: 42 }),
  },
];

const OUTPUT_WITHOUT_LAUNCH: ReportArtifact = {
  id: 'mock-resolves-report-without-launch' as ArtifactId,
  sessionId: SESSION.id,
  agentId: 'mock-resolves-agent-removed' as AgentId,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core postings',
  sourceFormat: 'markdown',
  sourceText: 'Postings round half up in two places and half even in one.',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: isoOf({ minutesAgo: 180 }),
  updatedAt: isoOf({ minutesAgo: 180 }),
  openedAt: null,
};

export const seedActivityResolvesScene = (): void => {
  seedActivityRunScene();
  const state = useAppStore.getState();
  const agents = [
    ...SEEDS.map((seed, index) => buildAgent({ seed, index })),
    buildImplementer(),
    ...SUBAGENT_SEEDS.map((seed, index) => buildSubagent({ seed, index })),
  ];
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
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [SESSION.id]: [...(state.sessionArtifacts[SESSION.id] ?? []), OUTPUT_WITHOUT_LAUNCH],
    },
    sessionEvents: {
      ...state.sessionEvents,
      [SESSION.id]: [...CONTEXT_EVENTS, ...(state.sessionEvents?.[SESSION.id] ?? [])],
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
      [IMPLEMENTER_ID]: {
        kind: 'running',
        runId: 'mock-resolves-run-implementer' as ProviderRunId,
        startedAt: isoOf({ minutesAgo: 36 }),
      },
      [subagentIdOf({ index: SUBAGENT_SEEDS.length - 1 })]: {
        kind: 'running',
        runId: `mock-resolves-run-subagent-${SUBAGENT_SEEDS.length - 1}` as ProviderRunId,
        startedAt: isoOf({ minutesAgo: 26 }),
      },
    },
    selectedAgentId: {},
  });
};

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
const LAUNCH_ID = 'mock-launch-pr-318';
const NOW_MS = Date.parse(NOW);

type Kind = 'ready' | 'drafting' | 'pushed' | 'failed';

type ResolveSeed = {
  readonly author: string;
  readonly file: string;
  readonly kind: Kind;
  readonly minutesBack?: number;
};

const LEGACY_BACK = 26 * 60;
const MOUNT_TARGET = {
  mountId: 'mock-mount-payments-api' as MountId,
  mountRevision: 1,
  worktreePath: '/Users/dev/harborline/payments-api',
};

const RUN_SEEDS: ReadonlyArray<ResolveSeed> = [
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

const LEGACY_SEEDS: ReadonlyArray<ResolveSeed> = [
  { author: 'tvarga', file: 'ledger.ts:4', kind: 'pushed', minutesBack: LEGACY_BACK },
  { author: 'tvarga', file: 'ledger.ts:18', kind: 'pushed', minutesBack: LEGACY_BACK + 2 },
  { author: 'iokafor', file: 'rounding.ts:31', kind: 'pushed', minutesBack: LEGACY_BACK + 4 },
  { author: 'mquint', file: 'rounding.ts:8', kind: 'failed', minutesBack: LEGACY_BACK + 5 },
];

const SEEDS: ReadonlyArray<ResolveSeed> = [...RUN_SEEDS, ...LEGACY_SEEDS];

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

const RUN_AGENT_ID = 'mock-resolves-agent-0' as AgentId;
const FIRST_ATTEMPT_ID = 'mock-resolves-attempt-first';
const FOLLOW_UP_ATTEMPT_ID = 'mock-resolves-attempt-follow-up';

const isoOf = ({ minutesAgo }: { readonly minutesAgo: number }): IsoDateTime =>
  new Date(NOW_MS - minutesAgo * 60_000).toISOString() as IsoDateTime;

const isInRun = ({ index }: { readonly index: number }): boolean => index < RUN_SEEDS.length;

const agentIdOf = ({ index }: { readonly index: number }): AgentId =>
  isInRun({ index }) ? RUN_AGENT_ID : (`mock-resolves-agent-${index}` as AgentId);

const attemptIdOf = ({
  seed,
  index,
}: {
  readonly seed: ResolveSeed;
  readonly index: number;
}): string => {
  if (!isInRun({ index })) {
    return `mock-resolves-attempt-${index}`;
  }
  return seed.kind === 'drafting' ? FOLLOW_UP_ATTEMPT_ID : FIRST_ATTEMPT_ID;
};

const buildRunAgent = (): Agent => ({
  id: RUN_AGENT_ID,
  sessionId: SESSION.id,
  ordinal: 6.05,
  name: `Resolve: ${RUN_SEEDS.length} review comments`,
  kind: 'resolver',
  status: 'running',
  runId: 'mock-resolves-run-0' as ProviderRunId,
  startedAt: isoOf({ minutesAgo: 24 }),
  lastViewedAt: NOW,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5',
  sourceThreadIds: RUN_SEEDS.map((_, index) => threadIdOf({ index })),
});

const buildLegacyAgent = ({
  seed,
  index,
}: {
  readonly seed: ResolveSeed;
  readonly index: number;
}): Agent => {
  const minutesAgo = index + 1 + (seed.minutesBack ?? 0);
  return {
    id: agentIdOf({ index }),
    sessionId: SESSION.id,
    ordinal: -index,
    name: `Resolve: ${seed.author} on ${seed.file}`,
    kind: 'resolver',
    status: AGENT_STATUS[seed.kind],
    runId: `mock-resolves-run-${index}` as ProviderRunId,
    startedAt: isoOf({ minutesAgo: minutesAgo + 1 }),
    completedAt: isoOf({ minutesAgo }),
    lastFinishedAt: isoOf({ minutesAgo }),
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
  ordinal: 5.5,
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
  ordinal: 5.5 + 0.01 * (index + 1),
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

const threadIdOf = ({ index }: { readonly index: number }): string => `PRRT_mock_resolves_${index}`;

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
  threadId: threadIdOf({ index }),
  originKind: 'review_comment',
  diffCommentId: null,
  state: THREAD_STATE[seed.kind],
  stage: STAGE[seed.kind],
  stateReason: null,
  revision: 1,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: attemptIdOf({ seed, index }),
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

const RUN_THREAD_IDS = RUN_SEEDS.map((_, index) => threadIdOf({ index }));
const FOLLOW_UP_THREAD_IDS = RUN_SEEDS.flatMap((seed, index) =>
  seed.kind === 'drafting' ? [threadIdOf({ index })] : [],
);

const buildRunAttempts = (): ReadonlyArray<ResolveAttempt> => {
  const base = {
    sessionId: SESSION.id,
    agentId: RUN_AGENT_ID,
    prNumber: PR_NUMBER,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: null,
    instructions: null,
    mountTarget: MOUNT_TARGET,
    batchId: BATCH_ID,
    launchId: LAUNCH_ID,
    copyPath: null,
    launchChoice: null,
  } as const;
  return [
    {
      ...base,
      id: FIRST_ATTEMPT_ID,
      threadIds: RUN_THREAD_IDS,
      phase: 'finished',
      startedAt: NOW_MS - 24 * 60_000,
      endedAt: NOW_MS - 12 * 60_000,
      error: null,
      failureCause: 'accept_conflict',
      createdAt: NOW_MS - 24 * 60_000,
    },
    {
      ...base,
      id: FOLLOW_UP_ATTEMPT_ID,
      threadIds: FOLLOW_UP_THREAD_IDS,
      phase: 'running',
      startedAt: NOW_MS - 3 * 60_000,
      endedAt: null,
      error: null,
      failureCause: null,
      createdAt: NOW_MS - 3 * 60_000,
    },
  ];
};

const buildLegacyAttempt = ({
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
    endedAt: NOW_MS - (index + 1) * 60_000 - back,
    error: seed.kind === 'failed' ? 'The draft stopped before it produced a change.' : null,
    failureCause: seed.kind === 'failed' ? 'provider_error' : null,
    createdAt: NOW_MS - (index + 2) * 60_000 - back,
    batchId: null,
    launchId: null,
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
    buildRunAgent(),
    ...LEGACY_SEEDS.map((seed, offset) =>
      buildLegacyAgent({ seed, index: RUN_SEEDS.length + offset }),
    ),
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
  const legacyAttempts = LEGACY_SEEDS.map((seed, offset) => {
    const index = RUN_SEEDS.length + offset;
    const thread = threads[index];
    if (thread === undefined) {
      throw new Error('resolve thread missing');
    }
    return buildLegacyAttempt({ seed, thread, index });
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
    sessionResolveAttempts: {
      ...state.sessionResolveAttempts,
      [SESSION.id]: [...buildRunAttempts(), ...legacyAttempts],
    },
    sessionResolvePublications: { ...state.sessionResolvePublications, [SESSION.id]: [] },
    loadResolveSession: async () => undefined,
    agentTurnState: {
      ...state.agentTurnState,
      [RUN_AGENT_ID]: {
        kind: 'running',
        runId: 'mock-resolves-run-0' as ProviderRunId,
        startedAt: isoOf({ minutesAgo: 3 }),
      },
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

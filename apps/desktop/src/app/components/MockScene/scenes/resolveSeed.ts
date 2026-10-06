import { mockSceneIpc } from './mockSceneIpc';
import type { InvokeArgs } from '@tauri-apps/api/core';
import type {
  PrComment,
  PullRequestState,
  ProjectId,
  ResolveAttempt,
  ResolveCandidate,
  ResolveCandidateItem,
  ResolveCheckRun,
  ResolvePublication,
  ResolvePublicationThread,
  ResolveQueueApprovalState,
  ResolveQueueItem,
  ResolveQueueItemWithThread,
  ResolveSourceSnapshot,
  ResolveThread,
  ResolveThreadState,
  ResolveStage,
  ProviderRunId,
  TurnEvent,
  AgentId,
  IsoDateTime,
  MountId,
  MountTargetSnapshot,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import type { ResolveCandidateWithItems } from '../../../../store/slices/resolve/state';
import { EMPTY_RESOLVE_QUEUE_VIEW } from '../../../../store/slices/session-view';
import { remoteMovedError } from '../../../../store/slices/resolve/remoteMovedError';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-09-04T14:20:00.000Z' });

export const WORKSPACE_ID = 'mock-resolve-workspace-harborline' as WorkspaceId;
export const SESSION_ID = 'mock-resolve-session-webhook-retry' as SessionId;
const PROJECT_ID = 'mock-resolve-project-payments-api' as ProjectId;

export const NOW_ISO = clock.iso({ at: '2026-09-04T14:20:00.000Z' });
const NOW_MS = Date.parse(NOW_ISO);
export const msAgo = ({ minutes }: { readonly minutes: number }): number =>
  NOW_MS - minutes * 60_000;
export const isoAgo = ({ minutes }: { readonly minutes: number }): string =>
  new Date(msAgo({ minutes })).toISOString();

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://example.invalid/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'pending',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: NOW_ISO,
};

export const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Resolve reviewer feedback on the webhook retry backoff PR',
  state: { kind: 'idle', lastActivityAt: NOW_ISO },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: PROJECT_ID,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

const T1 = 'PRRT_thread_retry_backoff';
const T2 = 'PRRT_thread_retry_metrics';
const T3 = 'PRRT_thread_error_shape';
const T4 = 'PRRT_thread_idempotency';
const T5 = 'PRRT_thread_log_redact';
const T6 = 'PRRT_thread_timeout_config';
const T7 = 'PRRT_thread_flaky_test';
const T8 = 'PRRT_thread_typo';
const T9 = 'PRRT_thread_retry_constant';

export const EXPANDED_THREAD_ID = T1;
export const THREAD_IDS = {
  errorShape: T3,
  idempotency: T4,
  metrics: T2,
  logRedact: T5,
  timeoutConfig: T6,
  typo: T8,
  retryConstant: T9,
} as const;
export const RESOLVE_SCENE_PR = PR;

const ITEM1_ID = 'mock-resolve-item-retry-backoff';
const ITEM2_ID = 'mock-resolve-item-retry-metrics';
const ITEM3_ID = 'mock-resolve-item-error-shape';
const ITEM4_ID = 'mock-resolve-item-idempotency';
const ITEM5_ID = 'mock-resolve-item-log-redact';
const ITEM6_ID = 'mock-resolve-item-timeout-config';
const ITEM7_ID = 'mock-resolve-item-flaky-test';
const ITEM8_ID = 'mock-resolve-item-typo';
const ITEM9_ID = 'mock-resolve-item-retry-constant';

const RESOLVE_LAUNCH_ID = 'mock-resolve-launch-318';
const ATTEMPT_RETRY_ID = 'mock-resolve-attempt-retry';
const ATTEMPT_IDEMPOTENCY_ID = 'mock-resolve-attempt-idempotency';
const CANDIDATE_RETRY_ID = 'mock-resolve-candidate-retry';
const PUBLICATION_ID = 'mock-resolve-publication-timeout-config';

const PROPOSAL_RETRY =
  'Added a capped exponential backoff (max 6 attempts) that reads the Retry-After header when the provider sends one, and emits a retry_backoff_exhausted metric once we give up.';

export type ThreadSeed = {
  readonly threadId: string;
  readonly state: ResolveThreadState;
  readonly stage: ResolveStage;
  readonly revision: number;
  readonly activeAttemptId: string | null;
  readonly disposition: 'fix' | 'reply' | 'no_change' | null;
  readonly replyDraft: string | null;
  readonly question: string | null;
  readonly createdMinutesAgo: number;
};

export const buildThread = (seed: ThreadSeed): ResolveThread => ({
  id: `mock-resolve-thread-${seed.threadId}`,
  sessionId: SESSION_ID,
  projectId: null,
  prNumber: PR.number,
  threadId: seed.threadId,
  originKind: 'review_comment',
  diffCommentId: null,
  state: seed.state,
  stage: seed.stage,
  stateReason: null,
  revision: seed.revision,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: seed.activeAttemptId,
  disposition: seed.disposition,
  replyDraft: seed.replyDraft,
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: seed.question,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: msAgo({ minutes: seed.createdMinutesAgo }),
  updatedAt: msAgo({ minutes: seed.createdMinutesAgo }),
});

export type ItemSeed = {
  readonly id: string;
  readonly threadId: string;
  readonly approvalState: ResolveQueueApprovalState;
  readonly approvedRevision: number | null;
  readonly deferredAt: number | null;
  readonly deliveredAt: number | null;
  readonly candidateRevision: number;
  readonly createdMinutesAgo: number;
  readonly integratedSha?: string | null;
};

export const buildItem = (seed: ItemSeed): ResolveQueueItem => ({
  id: seed.id,
  sessionId: SESSION_ID,
  threadId: seed.threadId,
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: seed.candidateRevision,
  approvalState: seed.approvalState,
  approvedRevision: seed.approvedRevision,
  approvedReplyHash: null,
  integratedSha: seed.integratedSha ?? null,
  deferredAt: seed.deferredAt,
  deliveredAt: seed.deliveredAt,
  supersededAt: null,
  createdAt: msAgo({ minutes: seed.createdMinutesAgo }),
  updatedAt: msAgo({ minutes: seed.createdMinutesAgo }),
});

const THREAD_RETRY_BACKOFF = buildThread({
  threadId: T1,
  state: 'fixed',
  stage: 'proposed',
  revision: 1,
  activeAttemptId: ATTEMPT_RETRY_ID,
  disposition: 'fix',
  replyDraft: PROPOSAL_RETRY,
  question: null,
  createdMinutesAgo: 90,
});
const THREAD_RETRY_METRICS = buildThread({
  threadId: T2,
  state: 'fixed',
  stage: 'proposed',
  revision: 1,
  activeAttemptId: ATTEMPT_RETRY_ID,
  disposition: 'fix',
  replyDraft: PROPOSAL_RETRY,
  question: null,
  createdMinutesAgo: 88,
});
const THREAD_ERROR_SHAPE = buildThread({
  threadId: T3,
  state: 'needs_answer',
  stage: 'asking',
  revision: 1,
  activeAttemptId: ATTEMPT_RETRY_ID,
  disposition: null,
  replyDraft: null,
  question: 'Should exhausted retries return a 200 with a warning, or fail hard?',
  createdMinutesAgo: 40,
});
const THREAD_IDEMPOTENCY = buildThread({
  threadId: T4,
  state: 'working',
  stage: 'working',
  revision: 1,
  activeAttemptId: ATTEMPT_IDEMPOTENCY_ID,
  disposition: null,
  replyDraft: null,
  question: null,
  createdMinutesAgo: 20,
});
const THREAD_LOG_REDACT = buildThread({
  threadId: T5,
  state: 'fixed',
  stage: 'approved',
  revision: 1,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Redacted the payload before logging; only the event id and status code remain.',
  question: null,
  createdMinutesAgo: 150,
});
const THREAD_TIMEOUT_CONFIG = buildThread({
  threadId: T6,
  state: 'closed',
  stage: 'resolved',
  revision: 1,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Moved the timeout to WEBHOOK_TIMEOUT_MS in config; default stays at 30000ms.',
  question: null,
  createdMinutesAgo: 210,
});
const THREAD_FLAKY_TEST = buildThread({
  threadId: T7,
  state: 'open',
  stage: 'parked',
  revision: 1,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  question: null,
  createdMinutesAgo: 300,
});
const THREAD_TYPO = buildThread({
  threadId: T8,
  state: 'open',
  stage: 'proposed',
  revision: 2,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Fixed the typo in the comment above the retry constant.',
  question: null,
  createdMinutesAgo: 500,
});

const THREAD_RETRY_CONSTANT = buildThread({
  threadId: T9,
  state: 'open',
  stage: 'new',
  revision: 1,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  question: null,
  createdMinutesAgo: 12,
});

const ITEM_RETRY_BACKOFF = buildItem({
  id: ITEM1_ID,
  threadId: T1,
  approvalState: 'none',
  approvedRevision: null,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 90,
});
const ITEM_RETRY_METRICS = buildItem({
  id: ITEM2_ID,
  threadId: T2,
  approvalState: 'none',
  approvedRevision: null,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 88,
});
const ITEM_ERROR_SHAPE = buildItem({
  id: ITEM3_ID,
  threadId: T3,
  approvalState: 'none',
  approvedRevision: null,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 40,
});
const ITEM_IDEMPOTENCY = buildItem({
  id: ITEM4_ID,
  threadId: T4,
  approvalState: 'none',
  approvedRevision: null,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 20,
});
const ITEM_LOG_REDACT = buildItem({
  id: ITEM5_ID,
  threadId: T5,
  approvalState: 'accepted',
  approvedRevision: 1,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 150,
  integratedSha: '4f21c8b9a7d3e6015482ba9c7d3e6f0158249bcd',
});
const ITEM_TIMEOUT_CONFIG = buildItem({
  id: ITEM6_ID,
  threadId: T6,
  approvalState: 'accepted',
  approvedRevision: 1,
  deferredAt: null,
  deliveredAt: msAgo({ minutes: 195 }),
  candidateRevision: 1,
  createdMinutesAgo: 210,
  integratedSha: '9ba3f70c25e18d4a6b0f39c7e21548d0a6b3f9c1',
});
const ITEM_FLAKY_TEST = buildItem({
  id: ITEM7_ID,
  threadId: T7,
  approvalState: 'deferred',
  approvedRevision: null,
  deferredAt: msAgo({ minutes: 100 }),
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 300,
});
const ITEM_TYPO = buildItem({
  id: ITEM8_ID,
  threadId: T8,
  approvalState: 'none',
  approvedRevision: null,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 2,
  createdMinutesAgo: 500,
});

const ITEM_RETRY_CONSTANT = buildItem({
  id: ITEM9_ID,
  threadId: T9,
  approvalState: 'none',
  approvedRevision: null,
  deferredAt: null,
  deliveredAt: null,
  candidateRevision: 1,
  createdMinutesAgo: 12,
});

const EXTRA_NEW: ReadonlyArray<{
  readonly threadId: string;
  readonly author: string;
  readonly path: string;
  readonly line: number;
  readonly minutesAgo: number;
  readonly body: string;
}> = [
  {
    threadId: 'PRRT_thread_jitter',
    author: 'omar-t',
    path: 'src/webhooks/retryPolicy.ts',
    line: 31,
    minutesAgo: 30,
    body: 'Add jitter so retried deliveries from many tenants do not line up.',
  },
  {
    threadId: 'PRRT_thread_log_delivery_id',
    author: 'nadia-p',
    path: 'src/webhooks/logging.ts',
    line: 44,
    minutesAgo: 45,
    body: 'Log the delivery id, not the whole body.',
  },
  {
    threadId: 'PRRT_thread_response_time',
    author: 'kenji-w',
    path: 'src/webhooks/metrics.ts',
    line: 4,
    minutesAgo: 60,
    body: 'Should we also record the response time of each attempt?',
  },
];

export const SELECTION_THREAD_IDS: ReadonlyArray<string> = [
  T9,
  ...EXTRA_NEW.slice(0, 2).map((extra) => extra.threadId),
];

const EXTRA_QUEUE_ITEMS: ReadonlyArray<ResolveQueueItemWithThread> = EXTRA_NEW.map((extra) => ({
  item: buildItem({
    id: `mock-resolve-item-${extra.threadId}`,
    threadId: extra.threadId,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: extra.minutesAgo,
  }),
  thread: buildThread({
    threadId: extra.threadId,
    state: 'open',
    stage: 'new',
    revision: 1,
    activeAttemptId: null,
    disposition: null,
    replyDraft: null,
    question: null,
    createdMinutesAgo: extra.minutesAgo,
  }),
}));

export const QUEUE_ITEMS: ReadonlyArray<ResolveQueueItemWithThread> = [
  { item: ITEM_RETRY_BACKOFF, thread: THREAD_RETRY_BACKOFF },
  { item: ITEM_RETRY_METRICS, thread: THREAD_RETRY_METRICS },
  { item: ITEM_ERROR_SHAPE, thread: THREAD_ERROR_SHAPE },
  { item: ITEM_IDEMPOTENCY, thread: THREAD_IDEMPOTENCY },
  { item: ITEM_LOG_REDACT, thread: THREAD_LOG_REDACT },
  { item: ITEM_TIMEOUT_CONFIG, thread: THREAD_TIMEOUT_CONFIG },
  { item: ITEM_FLAKY_TEST, thread: THREAD_FLAKY_TEST },
  { item: ITEM_TYPO, thread: THREAD_TYPO },
  { item: ITEM_RETRY_CONSTANT, thread: THREAD_RETRY_CONSTANT },
];

type NoteSeed = {
  readonly threadId: string;
  readonly body: string;
  readonly author: string;
  readonly path: string;
  readonly line: number;
  readonly createdMinutesAgo: number;
  readonly isOutdated?: boolean;
};

const buildNote = (seed: NoteSeed): PrComment => ({
  id: `mock-resolve-comment-${seed.threadId}`,
  author: seed.author,
  authorAvatarUrl: null,
  body: seed.body,
  createdAt: isoAgo({ minutes: seed.createdMinutesAgo }),
  url: `${PR.url}#discussion_${seed.threadId}`,
  source: 'review',
  path: seed.path,
  line: seed.line,
  resolved: false,
  outdated: seed.isOutdated ?? false,
  threadId: seed.threadId,
});

const TYPO_BEFORE = "Typo: 'shoudl' should be 'should' in the comment above the retry constant.";
const TYPO_ADDED = 'Also rename the flag to shouldRetry.';

const COMMENTS: ReadonlyArray<PrComment> = [
  buildNote({
    threadId: T1,
    author: 'kenji-w',
    path: 'src/webhooks/retryPolicy.ts',
    line: 42,
    createdMinutesAgo: 95,
    body: "This retries forever on a 429 without any cap, and it keeps hammering the provider even after they've told us to slow down. A single stuck webhook delivery can spin for hours and burn through the rate limit budget every other tenant depends on. Can we cap the attempts, back off exponentially, and honor the Retry-After header when the provider sends one?",
  }),
  buildNote({
    threadId: T2,
    author: 'kenji-w',
    path: 'src/webhooks/metrics.ts',
    line: 18,
    createdMinutesAgo: 93,
    body: "Same loop should emit a metric when it gives up, otherwise we'll never see this happening in production.",
  }),
  buildNote({
    threadId: T3,
    author: 'omar-t',
    path: 'src/webhooks/errorShape.ts',
    line: 9,
    createdMinutesAgo: 40,
    body: 'What should the client see once we give up retrying? A 200 with a warning, or a hard failure?',
  }),
  buildNote({
    threadId: T4,
    author: 'omar-t',
    path: 'src/webhooks/idempotency.ts',
    line: 55,
    createdMinutesAgo: 20,
    body: 'Two webhook deliveries for the same event id both inserted rows here. Are we missing a unique constraint on event_id?',
  }),
  buildNote({
    threadId: T5,
    author: 'kenji-w',
    path: 'src/webhooks/logging.ts',
    line: 12,
    createdMinutesAgo: 150,
    body: "This debug log dumps the full payload, including the customer's email address. Please redact it before it ships.",
  }),
  buildNote({
    threadId: T6,
    author: 'omar-t',
    path: 'src/webhooks/timeoutConfig.ts',
    line: 6,
    createdMinutesAgo: 210,
    body: 'The request timeout is hardcoded to 30 seconds. Can it come from config instead?',
  }),
  buildNote({
    threadId: T7,
    author: 'nadia-p',
    path: 'src/webhooks/retryPolicy.test.ts',
    line: 31,
    createdMinutesAgo: 300,
    isOutdated: true,
    body: 'This test sleeps for real between retries and flakes on a loaded runner. Can it use fake timers?',
  }),
  buildNote({
    threadId: T8,
    author: 'kenji-w',
    path: 'src/webhooks/config.ts',
    line: 3,
    createdMinutesAgo: 500,
    body: `${TYPO_BEFORE} ${TYPO_ADDED}`,
  }),
  buildNote({
    threadId: T9,
    author: 'nadia-p',
    path: 'src/webhooks/retryPolicy.ts',
    line: 7,
    createdMinutesAgo: 12,
    body: 'MAX_RETRY_ATTEMPTS now lives here and in config.ts. Can config own it so the two never drift?',
  }),
];

const EXTRA_COMMENTS: ReadonlyArray<PrComment> = EXTRA_NEW.map((extra) =>
  buildNote({
    threadId: extra.threadId,
    author: extra.author,
    path: extra.path,
    line: extra.line,
    createdMinutesAgo: extra.minutesAgo,
    body: extra.body,
  }),
);

const TYPO_SNAPSHOT: ResolveSourceSnapshot = {
  body: TYPO_BEFORE,
  author: 'kenji-w',
  fingerprint: 'mock-typo-before',
  seenAt: msAgo({ minutes: 480 }),
  replyIds: [],
  changed: {
    body: `${TYPO_BEFORE} ${TYPO_ADDED}`,
    author: 'kenji-w',
    fingerprint: 'mock-typo-after',
    seenAt: msAgo({ minutes: 30 }),
  },
};

const METRICS_REPLY: PrComment = {
  id: 'mock-resolve-comment-reply-metrics',
  author: 'nadia-p',
  authorAvatarUrl: null,
  body: 'Agreed. A counter per give-up reason would help too.',
  createdAt: isoAgo({ minutes: 20 }),
  url: `${PR.url}#discussion_reply_metrics`,
  source: 'review',
  path: 'src/webhooks/metrics.ts',
  line: 18,
  resolved: false,
  outdated: false,
  threadId: T2,
  inReplyToId: `mock-resolve-comment-${T2}`,
};

const METRICS_SNAPSHOT: ResolveSourceSnapshot = {
  body: 'Same loop should emit a metric when it gives up, otherwise we will never see this happening in production.',
  author: 'kenji-w',
  fingerprint: 'mock-metrics-root',
  seenAt: msAgo({ minutes: 85 }),
  replyIds: [],
  changed: null,
};

export const MOUNT_TARGET: MountTargetSnapshot = {
  mountId: 'mock-resolve-mount-payments-api' as MountId,
  mountRevision: 3,
  worktreePath: '~/code/harborline/payments-api-webhook-retry',
};

const ATTEMPT_RETRY: ResolveAttempt = {
  id: ATTEMPT_RETRY_ID,
  sessionId: SESSION_ID,
  agentId: 'mock-resolve-agent-retry' as AgentId,
  prNumber: PR.number,
  threadIds: [T1, T2, T3],
  launchId: RESOLVE_LAUNCH_ID,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  instructions: null,
  phase: 'finished',
  mountTarget: MOUNT_TARGET,
  startedAt: msAgo({ minutes: 70 }),
  endedAt: msAgo({ minutes: 52 }),
  error: null,
  createdAt: msAgo({ minutes: 70 }),
  batchId: null,
  copyPath: null,
  launchChoice: null,
};

const ATTEMPT_IDEMPOTENCY: ResolveAttempt = {
  id: ATTEMPT_IDEMPOTENCY_ID,
  sessionId: SESSION_ID,
  agentId: 'mock-resolve-agent-idempotency' as AgentId,
  prNumber: PR.number,
  threadIds: [T4],
  launchId: RESOLVE_LAUNCH_ID,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  instructions: null,
  phase: 'running',
  mountTarget: MOUNT_TARGET,
  startedAt: msAgo({ minutes: 6 }),
  endedAt: null,
  error: null,
  createdAt: msAgo({ minutes: 6 }),
  batchId: null,
  copyPath: null,
  launchChoice: null,
};

export const QUESTION_OPTIONS: ReadonlyArray<string> = [
  'Fail hard with a 503 and a Retry-After header',
  'Return a 200 with a warning in the body',
];

const QUESTION_ERROR_SHAPE: OpenQuestion = {
  id: 'mock-resolve-question-error-shape' as OpenQuestionId,
  sessionId: SESSION_ID,
  createdByAgentId: ATTEMPT_RETRY.agentId,
  text: 'Should exhausted retries return a 200 with a warning, or fail hard?',
  suggestedAnswers: QUESTION_OPTIONS,
  recommendedAnswer: QUESTION_OPTIONS[0],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: isoAgo({ minutes: 40 }) as IsoDateTime,
};

const CANDIDATE_RETRY: ResolveCandidate = {
  id: CANDIDATE_RETRY_ID,
  sessionId: SESSION_ID,
  revision: 1,
  baseSha: 'c81f4a20d95e73b6f10c8a4d29e75b3f60c19d84',
  candidateSha: 'e37b92c05a1f8d4e6b27c90a3f5d81e402b7c96a',
  worktreePath: MOUNT_TARGET.worktreePath,
  mountTarget: MOUNT_TARGET,
  state: 'ready',
  integratedSha: null,
  createdAt: msAgo({ minutes: 55 }),
  updatedAt: msAgo({ minutes: 52 }),
};

const CANDIDATE_ITEMS: ReadonlyArray<ResolveCandidateItem> = [
  { candidateId: CANDIDATE_RETRY_ID, queueItemId: ITEM1_ID, itemRevision: 1 },
  { candidateId: CANDIDATE_RETRY_ID, queueItemId: ITEM2_ID, itemRevision: 1 },
];

const RETRY_CHECK_COMMAND = 'pnpm vitest run retryPolicy';
const RETRY_TEST_IDENTITY = 'stops retrying after the cap and honors Retry-After';

const CHECK_RUNS: ReadonlyArray<ResolveCheckRun> = [
  {
    id: 'mock-resolve-check-base-retry',
    sessionId: SESSION_ID,
    candidateId: CANDIDATE_RETRY_ID,
    command: RETRY_CHECK_COMMAND,
    testIdentity: RETRY_TEST_IDENTITY,
    breadth: 'scoped',
    baseTree: CANDIDATE_RETRY.baseSha,
    candidateTree: null,
    acceptedSet: [],
    outcome: 'failed',
    exitCode: 1,
    durationMs: 4200,
    logRef: 'mock-resolve-log-base-retry',
    createdAt: msAgo({ minutes: 60 }),
  },
  {
    id: 'mock-resolve-check-candidate-retry',
    sessionId: SESSION_ID,
    candidateId: CANDIDATE_RETRY_ID,
    command: RETRY_CHECK_COMMAND,
    testIdentity: RETRY_TEST_IDENTITY,
    breadth: 'scoped',
    baseTree: CANDIDATE_RETRY.baseSha,
    candidateTree: CANDIDATE_RETRY.candidateSha,
    acceptedSet: [],
    outcome: 'passed',
    exitCode: 0,
    durationMs: 3100,
    logRef: 'mock-resolve-log-candidate-retry',
    createdAt: msAgo({ minutes: 53 }),
  },
];

const PUBLICATION: ResolvePublication = {
  id: PUBLICATION_ID,
  sessionId: SESSION_ID,
  repo: 'harborline/payments-api',
  prNumber: PR.number,
  branch: PR.headBranch,
  targetRef: `refs/heads/${PR.headBranch}`,
  localHead: 'sha-local-head-001',
  remoteHead: 'sha-local-head-001',
  commitShas: ['sha-local-head-001'],
  candidateIds: [],
  approvedItemIds: [ITEM6_ID],
  requiresPush: false,
  mountTarget: MOUNT_TARGET,
  phase: 'finished',
  pushedHead: 'sha-local-head-001',
  confirmedAt: msAgo({ minutes: 200 }),
  completedAt: msAgo({ minutes: 195 }),
  holder: null,
  heartbeatAt: null,
  error: null,
  createdAt: msAgo({ minutes: 205 }),
};

const PUBLICATION_THREAD_ROWS: ReadonlyArray<ResolvePublicationThread> = [
  {
    publicationId: PUBLICATION_ID,
    threadId: T6,
    revision: 1,
    priorState: 'fixed',
    sourceFingerprint: null,
    operationId: 'mock-resolve-op-timeout-config',
    replyBody: 'Moved the timeout to WEBHOOK_TIMEOUT_MS in config; default stays at 30000ms.',
    replyPhase: 'posted',
    replyId: 'mock-resolve-reply-timeout-config',
    replyAttemptedAt: msAgo({ minutes: 196 }),
    replyPostedAt: msAgo({ minutes: 195 }),
    resolvePhase: 'resolved',
    resolvedAt: msAgo({ minutes: 195 }),
    error: null,
  },
];

const FAKE_RETRY_DIFF = [
  'diff --git a/src/webhooks/retryPolicy.ts b/src/webhooks/retryPolicy.ts',
  '--- a/src/webhooks/retryPolicy.ts',
  '+++ b/src/webhooks/retryPolicy.ts',
  '@@ -10,4 +10,9 @@ export const scheduleRetry = (delivery: WebhookDelivery): void => {',
  '   const attempt = delivery.attempt + 1;',
  '-  const delayMs = 1000;',
  '-  setTimeout(() => sendWebhook(delivery), delayMs);',
  '+  if (attempt > MAX_RETRY_ATTEMPTS) {',
  "+    metrics.increment('retry_backoff_exhausted');",
  '+    return;',
  '+  }',
  '+  const retryAfterMs = delivery.retryAfterSeconds != null ? delivery.retryAfterSeconds * 1000 : null;',
  '+  const delayMs = retryAfterMs ?? Math.min(2 ** attempt * 1000, MAX_BACKOFF_MS);',
  '+  setTimeout(() => sendWebhook({ ...delivery, attempt }), delayMs);',
  '   };',
  'diff --git a/src/webhooks/metrics.ts b/src/webhooks/metrics.ts',
  '--- a/src/webhooks/metrics.ts',
  '+++ b/src/webhooks/metrics.ts',
  '@@ -1,3 +1,4 @@',
  ' export const metrics = {',
  "+  increment: (name: string) => emit('webhook_metric', { name }),",
  "   record: (name: string, value: number) => emit('webhook_metric', { name, value }),",
  ' };',
].join('\n');

const FAKE_COMMIT_DIFF = [
  'diff --git a/src/webhooks/metrics.ts b/src/webhooks/metrics.ts',
  '--- a/src/webhooks/metrics.ts',
  '+++ b/src/webhooks/metrics.ts',
  '@@ -16,5 +16,7 @@ export const metrics = {',
  '   record: (name: string, value: number) => emit(name, value),',
  '-  gaveUp: () => undefined,',
  '+  gaveUp: (reason: string) => {',
  "+    emit('retry_backoff_exhausted', 1);",
  "+    emit('retry_backoff_reason', reason);",
  '+  },',
  ' };',
].join('\n');

const payloadSql = ({ payload }: { readonly payload: InvokeArgs | undefined }): string => {
  if (payload === undefined || Array.isArray(payload)) {
    return '';
  }
  if (payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
    return '';
  }
  const sql = payload.sql;
  return typeof sql === 'string' ? sql : '';
};

const installResolveMockIpc = ({
  deliveredReplyBody,
}: {
  readonly deliveredReplyBody: string | null;
}): void => {
  mockSceneIpc((cmd, payload) => {
    if (cmd === 'worktree_diff_range') {
      return FAKE_RETRY_DIFF;
    }
    if (cmd === 'worktree_diff_commit') {
      return FAKE_COMMIT_DIFF;
    }
    if (cmd === 'db_select' && payloadSql({ payload }).includes('resolve_publication_threads')) {
      return deliveredReplyBody === null
        ? PUBLICATION_THREAD_ROWS
        : PUBLICATION_THREAD_ROWS.map((row) => ({ ...row, replyBody: deliveredReplyBody }));
    }
    return null;
  });
};

const EMPTY_GITHUB = {
  linkedIssues: [],
  fetchedAt: NOW_ISO,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

type ResolveFailure = 'run' | 'history';

type SeedParams = {
  readonly expandedThreadId: string | null;
  readonly failure?: ResolveFailure;
  readonly selectable?: boolean;
  readonly deliveredReplyBody?: string | null;
};

const CONNECTED_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = (
  [
    ['anthropic', 'claude', 'Claude'],
    ['codex', 'codex', 'Codex'],
  ] as const
).map(([id, binary, label]) => ({
  id,
  binary,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: '1.0.0',
  identity: 'harborline',
  label,
  error: null,
  docsUrl: 'https://example.invalid/docs',
}));

const FAILED_ATTEMPT_ID = 'mock-resolve-attempt-idempotency-failed';
const FIRST_ATTEMPT_ID = 'mock-resolve-attempt-idempotency-first';
const FAILED_AGENT_ID = 'mock-resolve-agent-idempotency-failed' as AgentId;
const FIRST_AGENT_ID = 'mock-resolve-agent-idempotency-first' as AgentId;

const failedAttempt = ({
  id,
  agentId,
  provider,
  model,
  effort,
  startedMinutesAgo,
  endedMinutesAgo,
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly provider: string;
  readonly model: string;
  readonly effort: string;
  readonly startedMinutesAgo: number;
  readonly endedMinutesAgo: number;
}): ResolveAttempt => ({
  ...ATTEMPT_IDEMPOTENCY,
  id,
  agentId,
  provider,
  model,
  effort,
  phase: 'failed',
  startedAt: msAgo({ minutes: startedMinutesAgo }),
  endedAt: msAgo({ minutes: endedMinutesAgo }),
  error: 'The provider returned an overloaded error',
  failureCause: 'provider_error',
  createdAt: msAgo({ minutes: startedMinutesAgo }),
});

const failedTranscript = ({
  runId,
}: {
  readonly runId: ProviderRunId;
}): ReadonlyArray<TurnEvent> => [
  {
    kind: 'tool_call_start',
    runId,
    toolUseId: 'mock-tool-tests',
    toolName: 'Bash',
    input: { command: 'pnpm test src/webhooks' },
    at: NOW_ISO as IsoDateTime,
  },
  {
    kind: 'tool_call_end',
    runId,
    toolUseId: 'mock-tool-tests',
    output: 'Tests  2 failed | 8 passed',
    isError: true,
    at: NOW_ISO as IsoDateTime,
  },
];

const PUSH_FAILURE_REASON = `publication_failed:${JSON.stringify({
  error: remoteMovedError({
    branch: PR.headBranch,
    remote: '8c1d2e47b90a',
    reviewed: '4f21c8b9a7d3',
  }),
})}`;

const failureSeed = ({ failure }: { readonly failure: ResolveFailure }) => {
  const isHistory = failure === 'history';
  const active = failedAttempt({
    id: FAILED_ATTEMPT_ID,
    agentId: FAILED_AGENT_ID,
    provider: isHistory ? 'codex' : 'anthropic',
    model: isHistory ? 'gpt-5.6-sol' : 'claude-sonnet-5',
    effort: isHistory ? 'high' : 'medium',
    startedMinutesAgo: 26,
    endedMinutesAgo: 22,
  });
  const first = failedAttempt({
    id: FIRST_ATTEMPT_ID,
    agentId: FIRST_AGENT_ID,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: 'medium',
    startedMinutesAgo: 40,
    endedMinutesAgo: 36,
  });
  const runThread: ResolveThread = {
    ...THREAD_IDEMPOTENCY,
    state: 'failed',
    stage: 'failed',
    stateReason: null,
    activeAttemptId: FAILED_ATTEMPT_ID,
  };
  const pushThread: ResolveThread = {
    ...THREAD_LOG_REDACT,
    state: 'failed',
    stage: 'failed',
    stateReason: PUSH_FAILURE_REASON,
  };
  const queue = QUEUE_ITEMS.map((entry) => {
    if (entry.thread.threadId === T4) {
      return { item: entry.item, thread: runThread };
    }
    return entry.thread.threadId === T5 ? { item: entry.item, thread: pushThread } : entry;
  });
  return {
    queue,
    attempts: isHistory ? [ATTEMPT_RETRY, first, active] : [ATTEMPT_RETRY, active],
    transcripts: {
      [FAILED_AGENT_ID]: failedTranscript({ runId: 'mock-run-failed' as ProviderRunId }),
    },
  };
};

export const seedResolveScene = ({
  expandedThreadId,
  failure,
  selectable = false,
  deliveredReplyBody = null,
}: SeedParams): void => {
  installResolveMockIpc({ deliveredReplyBody });
  const failed = failure === undefined ? null : failureSeed({ failure });

  const candidatesWithItems: ReadonlyArray<ResolveCandidateWithItems> = [
    { candidate: CANDIDATE_RETRY, items: CANDIDATE_ITEMS },
  ];

  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionResolveQueueItems: {
      [SESSION_ID]:
        failed?.queue ?? (selectable ? [...QUEUE_ITEMS, ...EXTRA_QUEUE_ITEMS] : QUEUE_ITEMS),
    },
    sessionResolveAttempts: {
      [SESSION_ID]: failed?.attempts ?? [ATTEMPT_RETRY, ATTEMPT_IDEMPOTENCY],
    },
    transcripts: failed?.transcripts ?? {},
    sessionOpenQuestions: { [SESSION_ID]: [QUESTION_ERROR_SHAPE] },
    ...(failed !== null && { providers: CONNECTED_PROVIDERS }),
    sessionResolveCandidates: { [SESSION_ID]: candidatesWithItems },
    sessionResolveCheckRuns: { [SESSION_ID]: CHECK_RUNS },
    sessionResolvePublications: { [SESSION_ID]: [PUBLICATION] },
    sessionResolveUncapturedWork: { [SESSION_ID]: null },
    sessionResolveSourceSnapshots: {
      [SESSION_ID]: { [T8]: TYPO_SNAPSHOT, [T2]: METRICS_SNAPSHOT },
    },
    resolveQueueView: {
      [SESSION_ID]: EMPTY_RESOLVE_QUEUE_VIEW,
    },
    drawer: null,
    branchTab: { [SESSION_ID]: 'comments' },
    branchThreadId: { [SESSION_ID]: expandedThreadId },
    sessionGithub: {
      [SESSION_ID]: {
        ...EMPTY_GITHUB,
        pr: PR,
        detail: {
          prNumber: PR.number,
          comments: selectable
            ? [...COMMENTS, ...EXTRA_COMMENTS, METRICS_REPLY]
            : [...COMMENTS, METRICS_REPLY],
          reviews: [],
          reviewRequests: [],
          checks: [],
        },
        detailFetchedAt: NOW_ISO,
      },
    },
    sessionExternalTasks: { [SESSION_ID]: [] },
    sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: SESSION.goal, enabled: true }] },
    sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
    sessionLoading: {
      [SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    summarizerStatus: {
      [SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW_ISO,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    },
    sessionPhaseRuns: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionWorkflows: { [SESSION_ID]: [] },
    phaseTemplates: { [WORKSPACE_ID]: [] },
    sessionTelemetry: { [SESSION_ID]: [] },
    activeLens: { [SESSION_ID]: null },
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    sessionAttachments: { [SESSION_ID]: [] },
    slotHistory: { [SESSION_ID]: {} },
    slotHistoryCounts: { [SESSION_ID]: {} },
    loadResolveSession: async () => undefined,
  });
};

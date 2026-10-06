import type {
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  PrComment,
  ResolveAttempt,
  ResolveFailureCause,
  ResolveQueueApprovalState,
  ResolveQueueItemWithThread,
  ResolveStage,
  ResolveThread,
  ResolveThreadState,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  RESOLVE_SCENE_PR,
  SESSION_ID,
  buildItem,
  buildThread,
  isoAgo,
  msAgo,
  seedResolveScene,
} from './resolveSeed';

export type BulkStage = 'launch' | 'answers' | 'review' | 'accepted' | 'retry';

type Word = 'open' | 'needs' | 'working' | 'ready' | 'failed' | 'done' | 'accepted';

type Cast = {
  readonly key: string;
  readonly author: string;
  readonly path: string;
  readonly line: number;
  readonly minutes: number;
  readonly body: string;
  readonly question?: {
    readonly text: string;
    readonly options: ReadonlyArray<string>;
    readonly recommended: string;
  };
  readonly reply?: string;
};

const CAST: Readonly<Record<string, Cast>> = {
  c1: {
    key: 'c1',
    author: 'omar-t',
    path: 'src/webhooks/errorShape.ts',
    line: 9,
    minutes: 12,
    body: 'What should the client see once a retry is refused?',
    question: {
      text: 'What should the client see once a retry is refused?',
      options: ['Return 409 with the retry hint', 'Return 200 and drop silently'],
      recommended: 'Return 409 with the retry hint',
    },
  },
  q2: {
    key: 'q2',
    author: 'nadia-p',
    path: 'src/webhooks/retryPolicy.ts',
    line: 31,
    minutes: 31,
    body: 'MAX_RETRY_ATTEMPTS now lives in two places, keep one.',
    question: {
      text: 'Which MAX_RETRY_ATTEMPTS should stay, the one in retryPolicy.ts or the one in config.ts?',
      options: ['Keep the one in retryPolicy.ts', 'Keep the one in config.ts'],
      recommended: 'Keep the one in retryPolicy.ts',
    },
    reply: 'Kept the constant in retryPolicy.ts and removed the copy from config.ts.',
  },
  r1: {
    key: 'r1',
    author: 'kenji-w',
    path: 'src/config.ts',
    line: 3,
    minutes: 45,
    body: "Typo: 'shoudl' should be 'should'.",
    reply: 'Fixed the typo in the refusal message.',
  },
  r2: {
    key: 'r2',
    author: 'kenji-w',
    path: 'src/webhooks/logging.ts',
    line: 12,
    minutes: 44,
    body: 'This debug log dumps the full payload, drop it.',
    reply: 'Dropped the payload from the debug log. It logs the delivery id only now.',
  },
  r3: {
    key: 'r3',
    author: 'kenji-w',
    path: 'src/webhooks/metrics.ts',
    line: 18,
    minutes: 40,
    body: 'Same loop should emit a metric when it retries.',
    reply: 'The loop emits webhook.retry on every pass now, tagged with the attempt number.',
  },
  r4: {
    key: 'r4',
    author: 'kenji-w',
    path: 'src/webhooks/retryPolicy.ts',
    line: 42,
    minutes: 38,
    body: 'This retries forever on a 429 with no ceiling.',
    reply: 'A 429 now stops at MAX_RETRY_ATTEMPTS like every other retry.',
  },
  r5: {
    key: 'r5',
    author: 'nadia-p',
    path: 'src/webhooks/logging.ts',
    line: 44,
    minutes: 45,
    body: 'Log the delivery id, not the whole body.',
    reply: 'Logging the delivery id now instead of the whole body.',
  },
  r6: {
    key: 'r6',
    author: 'omar-t',
    path: 'src/webhooks/retryPolicy.ts',
    line: 48,
    minutes: 20,
    body: 'Add jitter so retried deliveries from one burst do not land together.',
    reply: 'Added up to 100ms of jitter to the backoff.',
  },
  f1: {
    key: 'f1',
    author: 'omar-t',
    path: 'src/webhooks/idempotency.ts',
    line: 55,
    minutes: 20,
    body: 'Two webhook deliveries for the same event id both inserted rows here. Are we missing a unique constraint on event_id?',
  },
  f2: {
    key: 'f2',
    author: 'nadia-p',
    path: 'src/webhooks/retryPolicy.test.ts',
    line: 12,
    minutes: 60,
    body: 'This test sleeps for real between retries.',
  },
  d1: {
    key: 'd1',
    author: 'omar-t',
    path: 'src/webhooks/timeoutConfig.ts',
    line: 6,
    minutes: 60,
    body: 'The request timeout is hardcoded.',
    reply: 'Moved the timeout to config.',
  },
  d2: {
    key: 'd2',
    author: 'nadia-p',
    path: 'src/webhooks/retryPolicy.test.ts',
    line: 20,
    minutes: 60,
    body: 'Could this test use fake timers?',
  },
  d3: {
    key: 'd3',
    author: 'kenji-w',
    path: 'src/webhooks/metrics.ts',
    line: 4,
    minutes: 60,
    body: 'Should we also record the response status?',
    reply: 'It is recorded as a tag on the existing metric.',
  },
};

type Member = {
  readonly key: string;
  readonly word: Word;
  readonly inRun: boolean;
  readonly cause?: ResolveFailureCause;
};

const LAUNCH_ID = 'mock-bulk-launch';
const AGENT_ID = 'mock-bulk-agent' as AgentId;
const ATTEMPT_ID = 'mock-bulk-attempt';

const threadIdOf = ({ key }: { readonly key: string }): string => `PRRT_bulk_${key}`;
const itemIdOf = ({ key }: { readonly key: string }): string => `mock-bulk-item-${key}`;

const MEMBERS: Readonly<Record<BulkStage, ReadonlyArray<Member>>> = {
  launch: [
    { key: 'c1', word: 'needs', inRun: false },
    { key: 'r1', word: 'open', inRun: false },
    { key: 'r2', word: 'open', inRun: false },
    { key: 'r3', word: 'open', inRun: false },
    { key: 'r4', word: 'open', inRun: false },
    { key: 'r5', word: 'open', inRun: false },
    { key: 'r6', word: 'open', inRun: false },
    { key: 'q2', word: 'open', inRun: false },
    { key: 'f1', word: 'failed', inRun: false },
    { key: 'f2', word: 'failed', inRun: false },
  ],
  answers: [
    { key: 'c1', word: 'needs', inRun: true },
    { key: 'q2', word: 'needs', inRun: true },
    { key: 'r4', word: 'working', inRun: true },
    { key: 'r6', word: 'working', inRun: true },
    { key: 'f1', word: 'working', inRun: true },
    { key: 'r1', word: 'ready', inRun: true },
    { key: 'r2', word: 'ready', inRun: true },
    { key: 'r3', word: 'ready', inRun: true },
    { key: 'r5', word: 'ready', inRun: true },
  ],
  review: [
    { key: 'r1', word: 'ready', inRun: true },
    { key: 'r2', word: 'ready', inRun: true },
    { key: 'r3', word: 'ready', inRun: true },
    { key: 'r4', word: 'ready', inRun: true },
    { key: 'r5', word: 'ready', inRun: true },
    { key: 'f1', word: 'failed', inRun: true, cause: 'accept_conflict' },
    { key: 'd1', word: 'done', inRun: false },
    { key: 'd2', word: 'done', inRun: false },
    { key: 'd3', word: 'done', inRun: false },
  ],
  accepted: [
    { key: 'r1', word: 'accepted', inRun: true },
    { key: 'r2', word: 'accepted', inRun: true },
    { key: 'r3', word: 'accepted', inRun: true },
    { key: 'r4', word: 'accepted', inRun: true },
    { key: 'r5', word: 'accepted', inRun: true },
    { key: 'f1', word: 'failed', inRun: true, cause: 'accept_conflict' },
    { key: 'd1', word: 'done', inRun: false },
    { key: 'd2', word: 'done', inRun: false },
    { key: 'd3', word: 'done', inRun: false },
  ],
  retry: [
    { key: 'r1', word: 'ready', inRun: true },
    { key: 'r2', word: 'ready', inRun: true },
    { key: 'r3', word: 'ready', inRun: true },
    { key: 'r4', word: 'ready', inRun: true },
    { key: 'r5', word: 'ready', inRun: true },
    { key: 'r6', word: 'ready', inRun: true },
    { key: 'q2', word: 'ready', inRun: true },
    { key: 'f1', word: 'failed', inRun: true, cause: 'accept_conflict' },
    { key: 'd1', word: 'done', inRun: false },
  ],
};

const SELECTED_FOR_ACCEPT: ReadonlyArray<string> = ['r1', 'r2', 'r3'];

type Shape = {
  readonly state: ResolveThreadState;
  readonly stage: ResolveStage;
  readonly approval: ResolveQueueApprovalState;
  readonly disposition: ResolveThread['disposition'];
};

const SHAPE: Readonly<Record<Word, Shape>> = {
  open: { state: 'open', stage: 'new', approval: 'none', disposition: null },
  needs: { state: 'needs_answer', stage: 'asking', approval: 'none', disposition: null },
  working: { state: 'working', stage: 'working', approval: 'none', disposition: null },
  ready: { state: 'fixed', stage: 'proposed', approval: 'none', disposition: 'fix' },
  failed: { state: 'failed', stage: 'failed', approval: 'none', disposition: null },
  done: { state: 'closed', stage: 'resolved', approval: 'accepted', disposition: 'fix' },
  accepted: { state: 'fixed', stage: 'approved', approval: 'accepted', disposition: 'fix' },
};

const attemptOf = ({
  memberKeys,
  phase,
  endedMinutesAgo,
  cause,
  idSuffix = '',
}: {
  readonly memberKeys: ReadonlyArray<string>;
  readonly phase: ResolveAttempt['phase'];
  readonly endedMinutesAgo: number | null;
  readonly cause: ResolveFailureCause | null;
  readonly idSuffix?: string;
}): ResolveAttempt => ({
  id: `${ATTEMPT_ID}${idSuffix}`,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  prNumber: RESOLVE_SCENE_PR.number,
  threadIds: memberKeys.map((key) => threadIdOf({ key })),
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  instructions: null,
  phase,
  mountTarget: null,
  startedAt: msAgo({ minutes: 16 }),
  endedAt: endedMinutesAgo === null ? null : msAgo({ minutes: endedMinutesAgo }),
  error: null,
  failureCause: cause,
  createdAt: msAgo({ minutes: 16 }),
  batchId: LAUNCH_ID,
  launchId: LAUNCH_ID,
  copyPath: null,
  launchChoice: {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    commitStyle: null,
    hint: null,
  },
});

const commentOf = ({ cast }: { readonly cast: Cast }): PrComment => ({
  id: `mock-bulk-comment-${cast.key}`,
  author: cast.author,
  authorAvatarUrl: null,
  body: cast.body,
  createdAt: isoAgo({ minutes: cast.minutes }),
  url: `${RESOLVE_SCENE_PR.url}#discussion_${threadIdOf({ key: cast.key })}`,
  source: 'review',
  path: cast.path,
  line: cast.line,
  resolved: false,
  outdated: false,
  threadId: threadIdOf({ key: cast.key }),
});

const castOf = ({ key }: { readonly key: string }): Cast => {
  const cast = CAST[key];
  if (cast === undefined) {
    throw new Error(`no cast ${key}`);
  }
  return cast;
};

const queueOf = ({
  members,
  attemptId,
}: {
  readonly members: ReadonlyArray<Member>;
  readonly attemptId: string;
}): ReadonlyArray<ResolveQueueItemWithThread> =>
  members.map((member): ResolveQueueItemWithThread => {
    const cast = castOf({ key: member.key });
    const shape = SHAPE[member.word];
    const threadId = threadIdOf({ key: member.key });
    return {
      item: buildItem({
        id: itemIdOf({ key: member.key }),
        threadId,
        approvalState: shape.approval,
        approvedRevision: shape.approval === 'accepted' ? 1 : null,
        deferredAt: null,
        deliveredAt: member.word === 'done' ? msAgo({ minutes: 30 }) : null,
        candidateRevision: 1,
        createdMinutesAgo: cast.minutes,
      }),
      thread: {
        ...buildThread({
          threadId,
          state: shape.state,
          stage: shape.stage,
          revision: 1,
          activeAttemptId: member.inRun ? attemptId : null,
          disposition: shape.disposition,
          replyDraft:
            member.word === 'ready' || shape.approval === 'accepted' ? (cast.reply ?? null) : null,
          question: member.word === 'needs' ? (cast.question?.text ?? null) : null,
          createdMinutesAgo: cast.minutes,
        }),
        ...(member.word === 'accepted' && { commitShas: [`bulk${member.key}c0ffee`] }),
        ...(member.word === 'done' && {
          closedAt: msAgo({ minutes: 30 }),
          closedSource: 'goodboy' as const,
        }),
      },
    };
  });

const questionsOf = ({
  members,
}: {
  readonly members: ReadonlyArray<Member>;
}): ReadonlyArray<OpenQuestion> =>
  members.flatMap((member): ReadonlyArray<OpenQuestion> => {
    const { question } = castOf({ key: member.key });
    if (member.word !== 'needs' || !member.inRun || question === undefined) {
      return [];
    }
    return [
      {
        id: `mock-bulk-question-${member.key}` as OpenQuestionId,
        sessionId: SESSION_ID,
        createdByAgentId: AGENT_ID,
        text: question.text,
        suggestedAnswers: question.options,
        recommendedAnswer: question.recommended,
        isBlocking: true,
        userAnswer: null,
        status: 'open',
        createdAt: isoAgo({ minutes: 6 }) as IsoDateTime,
      },
    ];
  });

export const seedBulkScene = ({ stage }: { readonly stage: BulkStage }): void => {
  seedResolveScene({ expandedThreadId: null });
  const members = MEMBERS[stage];
  const inRun = members.filter((member) => member.inRun);
  const cause = members.find((member) => member.cause !== undefined)?.cause ?? null;
  const isRunning = members.some((member) => member.word === 'working');
  const attempts =
    inRun.length === 0
      ? []
      : [
          attemptOf({
            memberKeys: inRun.map((member) => member.key),
            phase: isRunning ? 'running' : 'finished',
            endedMinutesAgo: isRunning ? null : 4,
            cause,
          }),
        ];
  const state = useAppStore.getState();
  const github = state.sessionGithub[SESSION_ID];
  if (github === undefined) {
    return;
  }
  const itemIds = members
    .filter((member) => member.word === 'accepted')
    .map((member) => itemIdOf({ key: member.key }));
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: queueOf({ members, attemptId: ATTEMPT_ID }) },
    sessionResolveAttempts: { [SESSION_ID]: attempts },
    sessionResolveCandidates: { [SESSION_ID]: [] },
    sessionResolveCheckRuns: { [SESSION_ID]: [] },
    sessionResolvePublications: { [SESSION_ID]: [] },
    sessionResolveSourceSnapshots: { [SESSION_ID]: {} },
    sessionOpenQuestions: { [SESSION_ID]: questionsOf({ members }) },
    branchThreadId: { [SESSION_ID]: null },
    reviewSelection: {
      [SESSION_ID]: stage === 'review' ? SELECTED_FOR_ACCEPT.map((key) => threadIdOf({ key })) : [],
    },
    reviewBulkAccepts: {
      [SESSION_ID]: itemIds.length === 0 ? null : { operationId: 'mock-bulk-accept', itemIds },
    },
    sessionGithub: {
      [SESSION_ID]: {
        ...github,
        detail: {
          prNumber: RESOLVE_SCENE_PR.number,
          reviews: [],
          reviewRequests: [],
          checks: [],
          comments: members.map((member) => commentOf({ cast: castOf({ key: member.key }) })),
        },
      },
    },
  });
};

export const BULK_LAUNCH_THREAD_IDS: ReadonlyArray<string> = MEMBERS.launch
  .filter((member) => member.word === 'open' || member.word === 'failed')
  .map((member) => threadIdOf({ key: member.key }));

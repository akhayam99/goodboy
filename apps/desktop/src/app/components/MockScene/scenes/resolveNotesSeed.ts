import type {
  AgentId,
  DiffComment,
  IsoDateTime,
  ResolveAttempt,
  ResolveQueueItemWithThread,
  ResolveStage,
  ResolveThreadState,
  SessionId,
} from '@goodboy/types';
import { noteThreadId } from '../../../../features/resolve/notes/noteThread';
import { MOUNT_TARGET, buildItem, buildThread, isoAgo, msAgo } from './resolveSeed';

type NoteKey = 'open' | 'openSecond' | 'working' | 'needs' | 'ready' | 'failed' | 'done';

type NoteAttempt = {
  readonly phase: ResolveAttempt['phase'];
  readonly model: string;
  readonly effort: string;
  readonly commitStyle: 'new' | 'fixup';
};

type NoteSeed = {
  readonly id: string;
  readonly body: string;
  readonly minutesAgo: number;
  readonly isClosed: boolean;
  readonly state: ResolveThreadState;
  readonly stage: ResolveStage;
  readonly question: string | null;
  readonly attempt: NoteAttempt | null;
  readonly deliveredMinutesAgo: number | null;
};

export type NotePlace = {
  readonly filePath: string;
  readonly line: number;
};

const STARTED: NoteAttempt = {
  phase: 'running',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  commitStyle: 'new',
};

const SEEDS: Readonly<Record<NoteKey, NoteSeed>> = {
  open: {
    id: 'mock-note-backoff-cap',
    body: 'Cap the backoff at 30 seconds, the gateway drops the hook after a minute.',
    minutesAgo: 12,
    isClosed: false,
    state: 'open',
    stage: 'new',
    question: null,
    attempt: null,
    deliveredMinutesAgo: null,
  },
  openSecond: {
    id: 'mock-note-idempotency-key',
    body: 'The idempotency key should include the merchant id, not just the order.',
    minutesAgo: 9,
    isClosed: false,
    state: 'open',
    stage: 'new',
    question: null,
    attempt: null,
    deliveredMinutesAgo: null,
  },
  working: {
    id: 'mock-note-retry-log',
    body: 'Log the retry count once, not per attempt.',
    minutesAgo: 30,
    isClosed: false,
    state: 'working',
    stage: 'working',
    question: null,
    attempt: STARTED,
    deliveredMinutesAgo: null,
  },
  needs: {
    id: 'mock-note-refund-limit',
    body: 'Should refunds above the original charge be rejected here or in the API layer?',
    minutesAgo: 55,
    isClosed: false,
    state: 'needs_answer',
    stage: 'asking',
    question: 'Reject in the API layer, or here before the gateway call?',
    attempt: { phase: 'waiting', model: 'claude-sonnet-5-5', effort: 'high', commitStyle: 'fixup' },
    deliveredMinutesAgo: null,
  },
  ready: {
    id: 'mock-note-amount-minor',
    body: 'Rename amt to amountMinor so the unit is clear.',
    minutesAgo: 70,
    isClosed: false,
    state: 'fixed',
    stage: 'proposed',
    question: null,
    attempt: { phase: 'finished', model: 'claude-sonnet-5', effort: 'medium', commitStyle: 'new' },
    deliveredMinutesAgo: null,
  },
  failed: {
    id: 'mock-note-shared-retry',
    body: 'Use the shared retry helper instead of a local loop.',
    minutesAgo: 140,
    isClosed: false,
    state: 'failed',
    stage: 'failed',
    question: null,
    attempt: { phase: 'failed', model: 'claude-sonnet-5', effort: 'medium', commitStyle: 'new' },
    deliveredMinutesAgo: null,
  },
  done: {
    id: 'mock-note-redact-token',
    body: 'Redact the signing token before it reaches the log line.',
    minutesAgo: 180,
    isClosed: true,
    state: 'closed',
    stage: 'resolved',
    question: null,
    attempt: { phase: 'finished', model: 'claude-sonnet-5', effort: 'medium', commitStyle: 'new' },
    deliveredMinutesAgo: 120,
  },
};

const NOTE_KEYS: ReadonlyArray<NoteKey> = [
  'open',
  'openSecond',
  'working',
  'needs',
  'ready',
  'failed',
  'done',
];

export const NOTE_IDS: Readonly<Record<NoteKey, string>> = {
  open: SEEDS.open.id,
  openSecond: SEEDS.openSecond.id,
  working: SEEDS.working.id,
  needs: SEEDS.needs.id,
  ready: SEEDS.ready.id,
  failed: SEEDS.failed.id,
  done: SEEDS.done.id,
};

type Placed = {
  readonly sessionId: SessionId;
  readonly seed: NoteSeed;
  readonly place: NotePlace;
};

const attemptIdOf = ({ seed }: { readonly seed: NoteSeed }): string =>
  `mock-note-attempt-${seed.id}`;

const noteOf = ({ sessionId, seed, place }: Placed): DiffComment => ({
  id: seed.id,
  sessionId,
  filePath: place.filePath,
  body: seed.body,
  status: seed.isClosed ? 'resolved' : 'open',
  createdAt: isoAgo({ minutes: seed.minutesAgo }) as IsoDateTime,
  anchor: { side: 'new', lineNumber: place.line },
  authorKind: 'user',
});

const entryOf = ({ sessionId, seed }: Placed): ResolveQueueItemWithThread => {
  const threadId = noteThreadId({ noteId: seed.id });
  const thread = buildThread({
    threadId,
    state: seed.state,
    stage: seed.stage,
    revision: 1,
    activeAttemptId: seed.attempt === null ? null : attemptIdOf({ seed }),
    disposition: seed.stage === 'proposed' ? 'fix' : null,
    replyDraft: null,
    question: seed.question,
    createdMinutesAgo: seed.minutesAgo,
  });
  const item = buildItem({
    id: `mock-note-item-${seed.id}`,
    threadId,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt:
      seed.deliveredMinutesAgo === null ? null : msAgo({ minutes: seed.deliveredMinutesAgo }),
    candidateRevision: 1,
    createdMinutesAgo: seed.minutesAgo,
  });
  return {
    item: { ...item, sessionId },
    thread: {
      ...thread,
      sessionId,
      prNumber: null,
      originKind: 'diff_comment',
      diffCommentId: seed.id,
    },
  };
};

const attemptOf = ({ sessionId, seed }: Placed): ReadonlyArray<ResolveAttempt> => {
  const { attempt } = seed;
  if (attempt === null) {
    return [];
  }
  const isDone = attempt.phase === 'finished' || attempt.phase === 'failed';
  return [
    {
      id: attemptIdOf({ seed }),
      sessionId,
      agentId: `mock-note-agent-${seed.id}` as AgentId,
      prNumber: null,
      threadIds: [noteThreadId({ noteId: seed.id })],
      provider: 'anthropic',
      model: attempt.model,
      effort: attempt.effort,
      instructions: null,
      phase: attempt.phase,
      mountTarget: MOUNT_TARGET,
      startedAt: msAgo({ minutes: seed.minutesAgo - 2 }),
      endedAt: isDone ? msAgo({ minutes: seed.minutesAgo - 8 }) : null,
      error: attempt.phase === 'failed' ? 'The fixer stopped before it changed a file.' : null,
      createdAt: msAgo({ minutes: seed.minutesAgo - 2 }),
      batchId: null,
      copyPath: null,
      launchChoice: {
        provider: 'anthropic',
        model: attempt.model,
        effort: attempt.effort,
        commitStyle: attempt.commitStyle,
        hint: null,
      },
    },
  ];
};

const startedSeed = ({ seed }: { readonly seed: NoteSeed }): NoteSeed =>
  seed.stage === 'new' ? { ...seed, state: 'working', stage: 'working', attempt: STARTED } : seed;

export type ResolveNotes = {
  readonly notes: ReadonlyArray<DiffComment>;
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
};

type ForParams = {
  readonly sessionId: SessionId;
  readonly places: Readonly<Record<NoteKey, NotePlace>>;
  readonly isStarted?: boolean;
};

export const resolveNotesFor = ({
  sessionId,
  places,
  isStarted = false,
}: ForParams): ResolveNotes => {
  const placed = NOTE_KEYS.map((key): Placed => ({
    sessionId,
    seed: isStarted ? startedSeed({ seed: SEEDS[key] }) : SEEDS[key],
    place: places[key],
  }));
  return {
    notes: placed.map(noteOf),
    entries: placed.map(entryOf),
    attempts: placed.flatMap(attemptOf),
  };
};

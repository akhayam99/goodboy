import type {
  AgentRole,
  IsoDateTime,
  SessionContextItem,
  SessionContextItemId,
  SessionContextItemStatus,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { patchContextItemsState } from '../../../../store/slices/contextItems';

const HOUR = 3_600_000;

type Lesson = {
  readonly key: string;
  readonly topic: string;
  readonly title: string;
  readonly text: string;
  readonly project: string;
  readonly session: string | null;
  readonly hoursAgo: number;
  readonly turns: readonly [number, number];
  readonly role: AgentRole;
};

const LESSONS: ReadonlyArray<Lesson> = [
  {
    key: 'borrow',
    topic: 'Rust',
    title: 'Why the borrow checker rejects holding the retry queue across an await',
    text: 'The queue guard lives until the end of the block, so while the task is suspended the compiler still sees it borrowed. Drop the guard before the await, or move the retry state into the task.',
    project: 'notify-relay',
    session: 'relay',
    hoursAgo: 2,
    turns: [4, 6],
    role: 'investigator',
  },
  {
    key: 'select',
    topic: 'Rust',
    title: 'Why select! can drop a half-sent request',
    text: 'select! cancels every branch that did not win. A request future that lost the race is dropped mid-write. Send on a spawned task and select on its handle instead.',
    project: 'notify-relay',
    session: 'relay',
    hoursAgo: 2,
    turns: [7, 7],
    role: 'reviewer',
  },
  {
    key: 'lifetimes',
    topic: 'Rust',
    title: 'Lifetimes in the ledger snapshot iterator',
    text: 'The iterator borrows the snapshot, so it cannot outlive it. Returning owned rows ends the borrow and keeps the signature simple.',
    project: 'ledger-core',
    session: 'ledger',
    hoursAgo: 26,
    turns: [2, 3],
    role: 'reviewer',
  },
  {
    key: 'arc',
    topic: 'Rust',
    title: 'When to clone an Arc and when to pass a reference',
    text: 'Clone when the callee keeps the value past the call, for example in a spawned task. Pass a reference when it only reads during the call.',
    project: 'payments-api',
    session: 'payments',
    hoursAgo: 72,
    turns: [5, 5],
    role: 'reviewer',
  },
  {
    key: 'exhaustive',
    topic: 'Rust',
    title: 'Why this error enum needs non_exhaustive',
    text: 'Adding a variant to a public enum breaks every match in downstream crates. non_exhaustive makes that a minor change.',
    project: 'ledger-core',
    session: null,
    hoursAgo: 96,
    turns: [3, 3],
    role: 'reviewer',
  },
  {
    key: 'send-sync',
    topic: 'Rust',
    title: 'Send and Sync on the webhook client',
    text: 'The client holds a connection pool behind an Rc, which is not Send. Swapping it for an Arc lets the client move between tasks.',
    project: 'notify-relay',
    session: 'relay-old',
    hoursAgo: 144,
    turns: [1, 2],
    role: 'investigator',
  },
  {
    key: 'not-null',
    topic: 'Database migrations',
    title: 'Why a NOT NULL column needs a default first',
    text: 'On a table with rows, adding NOT NULL without a default fails. Add the column nullable, backfill, then set the constraint.',
    project: 'payments-api',
    session: 'payments',
    hoursAgo: 48,
    turns: [4, 4],
    role: 'reviewer',
  },
  {
    key: 'batches',
    topic: 'Database migrations',
    title: 'Backfill in batches, not inside the migration',
    text: 'A long backfill holds a lock for the whole migration. A separate job in small batches keeps writes flowing.',
    project: 'ledger-core',
    session: 'ledger',
    hoursAgo: 120,
    turns: [6, 8],
    role: 'investigator',
  },
  {
    key: 'concurrently',
    topic: 'Database migrations',
    title: 'Why the index is built concurrently',
    text: 'A plain CREATE INDEX blocks writes on the table. The concurrent form takes longer but lets payments keep writing.',
    project: 'payments-api',
    session: null,
    hoursAgo: 168,
    turns: [2, 2],
    role: 'reviewer',
  },
  {
    key: 'rename',
    topic: 'Database migrations',
    title: 'Renaming a column without breaking the running release',
    text: 'Old and new code run side by side during a deploy. Add the new column, write to both, move reads, then drop the old one.',
    project: 'ledger-core',
    session: 'ledger-rename',
    hoursAgo: 216,
    turns: [3, 5],
    role: 'planner',
  },
  {
    key: 'key-first',
    topic: 'Idempotency',
    title: 'An idempotency key must be stored before the first send',
    text: 'If the key is saved after the send, a crash in between loses it and the retry looks like a new delivery. Write it first, then send.',
    project: 'notify-relay',
    session: 'relay',
    hoursAgo: 1.5,
    turns: [8, 9],
    role: 'reviewer',
  },
  {
    key: 'per-delivery',
    topic: 'Idempotency',
    title: 'Why retries need one key per delivery, not per attempt',
    text: 'A key per attempt defeats the purpose: the receiver sees each retry as new. The key belongs to the delivery and stays the same across attempts.',
    project: 'notify-relay',
    session: 'relay-old',
    hoursAgo: 144,
    turns: [4, 4],
    role: 'investigator',
  },
];

export const LEARNING_TOPICS: ReadonlyArray<string> = [
  'Rust',
  'Database migrations',
  'Idempotency',
];

type ItemsParams = {
  readonly workspaceId: WorkspaceId;
  readonly nowMs: number;
  readonly sessionIdFor: (key: string) => SessionId;
};

const toItem = ({
  lesson,
  workspaceId,
  nowMs,
  sessionIdFor,
}: ItemsParams & { readonly lesson: Lesson }): SessionContextItem => {
  const at = new Date(nowMs - lesson.hoursAgo * HOUR).toISOString() as IsoDateTime;
  return {
    id: `mock-learning-${lesson.key}` as SessionContextItemId,
    sessionId: lesson.session === null ? null : sessionIdFor(lesson.session),
    workspaceId,
    kind: 'learning',
    title: lesson.title,
    text: lesson.text,
    topic: lesson.topic,
    source: {
      role: lesson.role,
      agentId: null,
      turnStart: lesson.turns[0],
      turnEnd: lesson.turns[1],
    },
    audience: [],
    status: 'active',
    projectName: lesson.project,
    isSessionDeleted: lesson.session === null,
    createdAt: at,
    updatedAt: at,
  };
};

export const workspaceLearningsSeed = (params: ItemsParams): ReadonlyArray<SessionContextItem> =>
  LESSONS.map((lesson) => toItem({ ...params, lesson }));

export const sessionLearningsSeed = (params: ItemsParams): ReadonlyArray<SessionContextItem> =>
  LESSONS.filter((lesson) => lesson.session === 'relay').map((lesson) =>
    toItem({ ...params, lesson }),
  );

type StatusParams = {
  readonly id: SessionContextItemId;
  readonly status: SessionContextItemStatus;
};

export const sceneSetContextItemStatus = async ({ id, status }: StatusParams): Promise<void> => {
  const updatedAt = new Date().toISOString() as IsoDateTime;
  useAppStore.setState((state) => patchContextItemsState({ state, id, status, updatedAt }));
};

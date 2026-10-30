import { treeSeedOf, type ChildSpec, type TreeSeed, type TreeSpec } from '../u27/agentsTreeSeed';

const done = { state: 'settled', outcome: 'completed' } as const;
const failed = { state: 'settled', outcome: 'failed' } as const;
const asking = { state: 'awaiting_confirm', outcome: null } as const;

type SubParams = {
  readonly key: string;
  readonly role: string;
  readonly title: string;
  readonly parentKey: string;
  readonly minute: number;
  readonly state: Pick<ChildSpec, 'state' | 'outcome'>;
};

const subOf = ({ key, role, title, parentKey, minute, state }: SubParams): ChildSpec => ({
  key,
  role,
  ...state,
  request: {
    title,
    task: 'Do it.',
    parent: { delegationId: `delegation-${parentKey}`, questionId: `question-${key}`, depth: 2 },
  },
  minute,
});

const RETRY: TreeSpec = {
  key: 'retry',
  phase: 'done',
  brief: 'Make the payments-api retry safe end to end.',
  minute: 90,
  ordinal: 3,
  children: [
    {
      key: 'retry-plan',
      role: 'planner',
      ...done,
      request: { title: 'Plan the retry safe credit flow', task: 'Plan it.' },
      minute: 91,
    },
    {
      key: 'retry-key',
      role: 'implementer',
      ...done,
      request: { title: 'Build the idempotency key once', task: 'Build it.' },
      minute: 92,
    },
    subOf({
      key: 'retry-key-callers',
      role: 'scout',
      title: 'Find every caller of postCredit',
      parentKey: 'retry-key',
      minute: 93,
      state: done,
    }),
    subOf({
      key: 'retry-key-unique',
      role: 'scout',
      title: 'Check the ledger-core unique key',
      parentKey: 'retry-key',
      minute: 94,
      state: done,
    }),
    {
      key: 'retry-race',
      role: 'implementer',
      ...done,
      request: { title: 'Fix the applyCredit race', task: 'Fix it.' },
      minute: 95,
    },
    subOf({
      key: 'retry-race-repro',
      role: 'tester',
      title: 'Reproduce the race',
      parentKey: 'retry-race',
      minute: 96,
      state: done,
    }),
    subOf({
      key: 'retry-race-replay',
      role: 'tester',
      title: 'Replay the notify-relay webhooks',
      parentKey: 'retry-race',
      minute: 97,
      state: failed,
    }),
    {
      key: 'retry-review',
      role: 'reviewer',
      ...done,
      request: { title: 'Review the ledger-core side', task: 'Review.' },
      minute: 98,
    },
    subOf({
      key: 'retry-review-owner',
      role: 'scout',
      title: 'Ask which ledger-core table owns the key',
      parentKey: 'retry-review',
      minute: 99,
      state: asking,
    }),
    subOf({
      key: 'retry-review-diff',
      role: 'scout',
      title: 'Read the ledger-core diff',
      parentKey: 'retry-review',
      minute: 100,
      state: done,
    }),
  ],
};

const CACHE: TreeSpec = {
  key: 'cache',
  phase: 'done',
  brief: 'Why does the Harborline cache miss on every deploy?',
  minute: 40,
  ordinal: 2,
  children: [
    {
      key: 'cache-scout',
      role: 'scout',
      ...done,
      request: { title: 'Find where the cache key is built', task: 'Find it.' },
      minute: 41,
    },
    {
      key: 'cache-fix',
      role: 'implementer',
      ...failed,
      request: { title: 'Keep the cache key across deploys', task: 'Fix it.' },
      minute: 45,
    },
    {
      key: 'cache-review',
      role: 'reviewer',
      ...done,
      request: { title: 'Review the cache key change', task: 'Review.' },
      minute: 50,
    },
  ],
};

const NOTES: TreeSpec = {
  key: 'notes',
  phase: 'done',
  brief: 'Write the Northwind release notes for 2.4.',
  minute: 10,
  ordinal: 1,
  children: [
    {
      key: 'notes-scout',
      role: 'scout',
      ...done,
      request: { title: 'List the merged changes since 2.3', task: 'List.' },
      minute: 11,
    },
    {
      key: 'notes-write',
      role: 'docs',
      ...done,
      request: { title: 'Write the 2.4 release notes', task: 'Write.' },
      minute: 15,
    },
  ],
};

export const FOLD_SEED: TreeSeed = treeSeedOf({
  trees: [RETRY, CACHE, NOTES],
  selectedKey: RETRY.key,
});

import type { LinearIssue } from '../../../../../../features/integrations/linear/client';
import type { SentryIssue } from '../../../../../../features/integrations/sentry/client';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type AgoParams = {
  readonly ms: number;
};

const isoAgo = ({ ms }: AgoParams): string => new Date(Date.now() - ms).toISOString();

type LinearParams = {
  readonly id: string;
  readonly title: string;
  readonly state: LinearIssue['state'];
  readonly project: string;
  readonly ago: number;
};

const linearIssue = ({ id, title, state, project, ago }: LinearParams): LinearIssue => ({
  id: `mock-task-picker-linear-${id}`,
  identifier: id,
  title,
  description: null,
  url: `https://example.invalid/linear/${id}`,
  state,
  team: { key: id.split('-')[0] ?? 'HBL' },
  project: { name: project },
  updatedAt: isoAgo({ ms: ago }),
});

type GithubParams = {
  readonly number: number;
  readonly repo: string;
  readonly title: string;
  readonly ago: number;
};

const githubIssue = ({ number, repo, title, ago }: GithubParams) => ({
  number,
  title,
  body: null,
  url: `https://github.com/${repo}/issues/${number}`,
  state: 'OPEN',
  labels: [],
  assignees: [{ login: 'robin-v' }],
  author: { login: 'robin-v' },
  updatedAt: isoAgo({ ms: ago }),
});

type SentryParams = {
  readonly id: string;
  readonly shortId: string;
  readonly title: string;
  readonly culprit: string;
  readonly ago: number;
};

const sentryIssue = ({ id, shortId, title, culprit, ago }: SentryParams): SentryIssue => ({
  id,
  project: null,
  shortId,
  title,
  culprit,
  level: 'error',
  status: 'unresolved',
  count: '184',
  userCount: 41,
  firstSeen: isoAgo({ ms: 3 * DAY }),
  lastSeen: isoAgo({ ms: ago }),
  permalink: `https://example.invalid/sentry/${shortId}`,
  metadata: null,
});

export const TASK_PICKER_SEED = {
  repo: 'harborline/payments-api',
  linear: [
    linearIssue({
      id: 'HBL-412',
      title: 'Ledger export times out over 10k rows when the merchant has split payouts enabled',
      state: { name: 'In Progress', type: 'started' },
      project: 'ledger-core',
      ago: 25 * MINUTE,
    }),
    linearIssue({
      id: 'HBL-415',
      title: 'Refund runs twice on a retried charge',
      state: { name: 'Todo', type: 'unstarted' },
      project: 'payments-api',
      ago: 3 * HOUR,
    }),
    linearIssue({
      id: 'HBL-398',
      title: 'Show the payout hold reason on the merchant page',
      state: { name: 'Backlog', type: 'backlog' },
      project: 'payments-api',
      ago: 2 * DAY,
    }),
  ],
  github: [
    githubIssue({
      number: 418,
      repo: 'harborline/payments-api',
      title: 'Stream the ledger export instead of buffering it',
      ago: 50 * MINUTE,
    }),
    githubIssue({
      number: 402,
      repo: 'harborline/payments-api',
      title: 'Webhook signatures fail after the notify-relay key rotation',
      ago: 6 * HOUR,
    }),
  ],
  sentry: [
    sentryIssue({
      id: 'mock-task-picker-sentry-1',
      shortId: 'PAYMENTS-API-7F2',
      title: 'TypeError: cannot read properties of undefined (reading payout)',
      culprit: 'ledger/export.ts',
      ago: 12 * MINUTE,
    }),
    sentryIssue({
      id: 'mock-task-picker-sentry-2',
      shortId: 'NOTIFY-RELAY-2F',
      title: 'Timeout delivering a webhook to Northwind',
      culprit: 'relay/deliver.ts',
      ago: 9 * HOUR,
    }),
  ],
} as const;

import type { ProjectId, SessionId } from '@goodboy/types';
import type { InboxRecord, InboxState } from '../../../../../../features/inbox/types';
import type { JiraUser } from '../../../../../../features/integrations/jira/client';
import type { LinearIssue } from '../../../../../../features/integrations/linear/client';
import { brandedId } from '../../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../../sceneClock';
import { HBL_398, HBL_412 } from '../../brand/kickoffIssues';

const CLOCK = sceneClock({ anchor: '2026-10-16T09:00:00Z' });

const MINUTE = 60_000;

const LEDGER_PROJECT = brandedId<ProjectId>({ value: 'mock-board-project-ledger-core' });
const PAYMENTS_PROJECT = brandedId<ProjectId>({ value: 'mock-board-project-payments-api' });
const LINKED_SESSION = brandedId<SessionId>({
  value: 'mock-board-session-settlement-rounding',
});

type AgoParams = {
  readonly minutes: number;
};

const isoAgo = ({ minutes }: AgoParams): string =>
  new Date(CLOCK.ms({ at: '2026-10-16T09:00:00Z' }) - minutes * MINUTE).toISOString();

type LinearStatus = {
  readonly name: string;
  readonly type: string;
  readonly state: InboxState;
};

const LINEAR_STATES: ReadonlyArray<LinearStatus> = [
  { name: 'In progress', type: 'started', state: 'active' },
  { name: 'Todo', type: 'unstarted', state: 'open' },
  { name: 'Backlog', type: 'backlog', state: 'open' },
];

const TOPICS: ReadonlyArray<string> = [
  'Ledger export times out over 10k rows',
  'Webhook retries stop after the first failure',
  'Refunds on split payments leave the second charge captured',
  'Settlement report rounds negative fees up',
  'Notify relay drops messages when the queue is full',
  'Payout batch skips accounts opened today',
  'Currency switch keeps the old symbol on receipts',
  'Invoice PDF cuts the last line on long orders',
];

type IndexParams = {
  readonly index: number;
};

const topicOf = ({ index }: IndexParams): string =>
  `${TOPICS[index % TOPICS.length] ?? ''}${index < TOPICS.length ? '' : ` (${index})`}`;

type RecordParams = IndexParams & {
  readonly minutes: number;
};

type RangeParams = {
  readonly count: number;
};

type LinearParams = IndexParams & {
  readonly minutes: number;
  readonly sessionId?: SessionId | null;
  readonly projectIds?: ReadonlyArray<ProjectId>;
};

const MARA: JiraUser = {
  accountId: 'mock-c12-mara',
  displayName: 'Mara Lindqvist',
  emailAddress: null,
  avatarUrls: null,
  active: true,
};

export const LEDGER_ISSUE: LinearIssue = {
  id: 'mock-c12-linear-412',
  identifier: 'HBL-412',
  title: 'Ledger export times out over 10k rows',
  description: [
    'Exporting the ledger for a month with more than 10,000 rows times out after 30 seconds.',
    '',
    '- Stream the rows instead of building the file in memory',
    '- Keep the CSV header order the finance team uses',
  ].join('\n'),
  url: 'https://example.invalid/linear/HBL-412',
  state: { name: 'In progress', type: 'started' },
  team: { key: 'HBL' },
  priority: 2,
  priorityLabel: 'High',
  assignee: { name: MARA.displayName },
  creator: { name: 'Tomas Okafor' },
  project: { name: 'Ledger' },
  labels: {
    nodes: [...(HBL_412.labels?.nodes ?? []), ...(HBL_398.labels?.nodes ?? [])],
  },
  updatedAt: isoAgo({ minutes: 4 }),
  attachments: {
    nodes: [
      {
        id: 'mock-c12-pr-418',
        title: 'Stream the ledger export',
        url: 'https://example.invalid/github/harborline/ledger-core/pull/418',
        sourceType: 'github',
        metadata: { status: 'merged', number: 418 },
      },
      {
        id: 'mock-c12-pr-421',
        title: 'Keep the header order',
        url: 'https://example.invalid/github/harborline/ledger-core/pull/421',
        sourceType: 'github',
        metadata: { status: 'merged', number: 421 },
      },
    ],
  },
};

export const LEDGER_RECORD: InboxRecord = {
  key: `linear:issue:${LEDGER_ISSUE.id}`,
  provider: 'linear',
  kind: 'issue',
  identifier: LEDGER_ISSUE.identifier,
  title: LEDGER_ISSUE.title,
  state: 'active',
  stateLabel: 'In progress',
  updatedAt: LEDGER_ISSUE.updatedAt,
  url: LEDGER_ISSUE.url,
  context: 'Ledger',
  projectIds: [LEDGER_PROJECT],
  payload: { provider: 'linear', kind: 'issue', issue: LEDGER_ISSUE, sessionId: LINKED_SESSION },
};

const linearRecord = ({
  index,
  minutes,
  sessionId = null,
  projectIds,
}: LinearParams): InboxRecord => {
  const status = LINEAR_STATES[index % LINEAR_STATES.length] ?? LINEAR_STATES[0]!;
  const identifier = `HBL-${1000 + index}`;
  const title = topicOf({ index });
  const issue: LinearIssue = {
    id: `mock-c12-linear-${index}`,
    identifier,
    title,
    description: null,
    url: `https://example.invalid/linear/${identifier}`,
    state: { name: status.name, type: status.type },
    team: { key: 'HBL' },
    priority: (index % 4) + 1,
    priorityLabel: ['Urgent', 'High', 'Medium', 'Low'][index % 4] ?? 'Low',
    project: { name: 'Ledger' },
    assignee: index % 40 === 0 ? { name: MARA.displayName } : null,
    updatedAt: isoAgo({ minutes }),
  };
  return {
    key: `linear:issue:${issue.id}`,
    provider: 'linear',
    kind: 'issue',
    identifier,
    title,
    state: status.state,
    stateLabel: status.name,
    updatedAt: issue.updatedAt,
    url: issue.url,
    context: 'Ledger',
    ...(projectIds === undefined ? {} : { projectIds }),
    payload: { provider: 'linear', kind: 'issue', issue, sessionId },
  };
};

const githubRecord = ({ index, minutes }: RecordParams): InboxRecord => {
  const number = 500 + index;
  const title = topicOf({ index: index + 3 });
  const url = `https://example.invalid/github/harborline/payments-api/issues/${number}`;
  return {
    key: `github:issue:${number}`,
    provider: 'github',
    kind: 'issue',
    identifier: `#${number}`,
    title,
    state: 'open',
    stateLabel: 'Open',
    updatedAt: isoAgo({ minutes }),
    url,
    context: 'payments-api',
    projectIds: [PAYMENTS_PROJECT],
    payload: {
      provider: 'github',
      kind: 'issue',
      issue: {
        number,
        title,
        body: '',
        url,
        state: 'OPEN',
        labels: ['bug'],
        updatedAt: isoAgo({ minutes }),
        author: 'Tomas Okafor',
      },
      sessionId: null,
    },
  };
};

const jiraRecord = ({ index, minutes }: RecordParams): InboxRecord => {
  const key = `NW-${200 + index}`;
  const summary = topicOf({ index: index + 5 });
  const url = `https://example.invalid/jira/${key}`;
  return {
    key: `jira:issue:${key}`,
    provider: 'jira',
    kind: 'issue',
    identifier: key,
    title: summary,
    state: 'open',
    stateLabel: 'To Do',
    updatedAt: isoAgo({ minutes }),
    url,
    context: 'Northwind',
    payload: {
      provider: 'jira',
      kind: 'issue',
      issue: {
        id: `mock-c12-jira-${index}`,
        key,
        summary,
        description: '',
        status: 'To Do',
        statusCategory: 'new',
        issueType: 'Task',
        priority: 'Medium',
        assignee: index % 40 === 0 ? MARA : null,
        reporter: null,
        labels: [],
        created: isoAgo({ minutes: minutes + 600 }),
        updated: isoAgo({ minutes }),
        url,
      },
      sessionId: null,
    },
  };
};

const sentryRecord = ({ index, minutes }: RecordParams): InboxRecord => {
  const shortId = `PAYMENTS-API-${7000 + index}`;
  const title = `TypeError in ${['ledger export', 'refund job', 'payout batch', 'webhook relay'][index % 4] ?? 'ledger export'}`;
  return {
    key: `sentry:error:${shortId}`,
    provider: 'sentry',
    kind: 'error',
    identifier: shortId,
    title,
    state: 'alert',
    stateLabel: 'Unresolved',
    updatedAt: isoAgo({ minutes }),
    url: `https://example.invalid/sentry/${shortId}`,
    context: 'payments-api',
    projectIds: [PAYMENTS_PROJECT],
    payload: {
      provider: 'sentry',
      kind: 'error',
      issue: {
        id: `mock-c12-sentry-${index}`,
        shortId,
        title,
        culprit: 'ledger/export.ts',
        level: 'error',
        status: 'unresolved',
        count: String(10 + index),
        userCount: 3,
        firstSeen: isoAgo({ minutes: minutes + 900 }),
        lastSeen: isoAgo({ minutes }),
        permalink: null,
        metadata: null,
      },
      sessionId: null,
    },
  };
};

const slackRecord = ({ index, minutes }: RecordParams): InboxRecord => {
  const ts = `1760600${String(index).padStart(3, '0')}.000100`;
  const text = `Can someone look at ${topicOf({ index: index + 1 }).toLowerCase()}?`;
  return {
    key: `slack:thread:${ts}`,
    provider: 'slack',
    kind: 'thread',
    identifier: '#payments',
    title: text,
    state: 'active',
    stateLabel: 'Open',
    updatedAt: isoAgo({ minutes }),
    url: `https://example.invalid/slack/${ts}`,
    context: 'payments',
    payload: {
      provider: 'slack',
      kind: 'thread',
      channel: { id: 'C-PAYMENTS', name: 'payments', isMember: true, topic: null, memberCount: 12 },
      head: {
        ts,
        threadTs: ts,
        userId: null,
        botId: null,
        text,
        subtype: null,
        replyCount: 2,
        replyUserCount: 2,
        postedAt: null,
        latestReplyAt: null,
        reactions: [],
      },
      sessionId: null,
    },
  };
};

type CountParams = {
  readonly linear: number;
  readonly github: number;
  readonly jira: number;
  readonly sentry: number;
  readonly slack: number;
};

const range = ({ count }: RangeParams): ReadonlyArray<number> =>
  Array.from({ length: count }, (_, index) => index);

const tasksOf = ({
  linear,
  github,
  jira,
  sentry,
  slack,
}: CountParams): ReadonlyArray<InboxRecord> => [
  LEDGER_RECORD,
  ...range({ count: linear - 1 }).map((index) =>
    linearRecord({
      index,
      minutes: 9 + index * 7,
      ...(index % 9 === 0 ? { projectIds: [LEDGER_PROJECT] } : {}),
    }),
  ),
  ...range({ count: github }).map((index) => githubRecord({ index, minutes: 12 + index * 9 })),
  ...range({ count: jira }).map((index) => jiraRecord({ index, minutes: 30 + index * 11 })),
  ...range({ count: sentry }).map((index) => sentryRecord({ index, minutes: 6 + index * 13 })),
  ...range({ count: slack }).map((index) => slackRecord({ index, minutes: 20 + index * 17 })),
];

export const WORKSPACE_TASKS = tasksOf({
  linear: 412,
  github: 12,
  jira: 380,
  sentry: 172,
  slack: 48,
});

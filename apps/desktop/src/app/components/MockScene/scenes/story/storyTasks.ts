import { brandId, type IsoDateTime } from '@goodboy/types';
import type {
  GitlabIssue,
  GitlabMergeRequest,
} from '../../../../../features/integrations/gitlab/client';
import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import type {
  SentryIssue,
  SentryIssueDetail,
} from '../../../../../features/integrations/sentry/client';
import type {
  SlackChannel,
  SlackMessage,
  SlackUser,
} from '../../../../../features/integrations/slack/client';
import { STORY_ISSUE } from './storyContent';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const STARTED_AT = Date.now();

type AgoParams = {
  readonly ms: number;
};

const isoAgo = ({ ms }: AgoParams): string => new Date(STARTED_AT - ms).toISOString();

type TsParams = {
  readonly ms: number;
};

const slackTs = ({ ms }: TsParams): string => `${Math.floor((STARTED_AT - ms) / 1000)}.000100`;

export const STORY_TASK_COUNT = 11;

export const STORY_EXAMPLE_KEY = 'lin_api_EXAMPLE_demo_key_only_works_in_this_demo';

export const STORY_VIEWER = {
  id: 'demo-story-linear-dana',
  name: 'Dana R.',
  email: 'dana@harborline.dev',
  organization: { urlKey: 'harborline', name: 'Harborline' },
} as const;

type LinearParams = {
  readonly identifier: string;
  readonly title: string;
  readonly description: string;
  readonly priority: number;
  readonly priorityLabel: string;
  readonly project: string;
  readonly ago: number;
};

const linearIssueOf = ({
  identifier,
  title,
  description,
  priority,
  priorityLabel,
  project,
  ago,
}: LinearParams): LinearIssue => ({
  id: `demo-story-linear-${identifier}`,
  identifier,
  title,
  description,
  url: `https://example.invalid/linear/${identifier}`,
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'HBL' },
  priority,
  priorityLabel,
  assignee: { name: STORY_VIEWER.name },
  project: { name: project },
  labels: { nodes: [] },
  updatedAt: isoAgo({ ms: ago }),
});

export const storyLinearIssues = (): ReadonlyArray<LinearIssue> => [
  linearIssueOf({
    identifier: STORY_ISSUE.identifier,
    title: STORY_ISSUE.title,
    description: STORY_ISSUE.description,
    priority: 1,
    priorityLabel: 'Urgent',
    project: 'payments-api',
    ago: 12 * MINUTE,
  }),
  linearIssueOf({
    identifier: 'HBL-409',
    title: 'Statement export drops the last day',
    description:
      'The CSV statement stops at 23:00 on the last day of the range. Entries posted in the final hour are missing.',
    priority: 2,
    priorityLabel: 'High',
    project: 'ledger-core',
    ago: 3 * HOUR,
  }),
  linearIssueOf({
    identifier: 'HBL-397',
    title: 'Rename settlement batches in the dashboard',
    description:
      'Ops call them payout runs. The dashboard still says settlement batches in three places.',
    priority: 4,
    priorityLabel: 'Low',
    project: 'payments-api',
    ago: 2 * DAY,
  }),
];

const GITHUB_PR_BODY = [
  'Stores the delivery id with every posted credit and refuses a second post for the same id.',
  '',
  'Review requested from you.',
].join('\n');

export const storyGithubPrs = (): ReadonlyArray<object> => [
  {
    number: 318,
    title: 'Idempotency key on webhook retries',
    url: 'https://github.com/harborline/payments-api/pull/318',
    state: 'OPEN',
    isDraft: false,
    mergeable: 'MERGEABLE',
    baseRefName: 'main',
    headRefName: 'marco-l/idempotency-key',
    reviewDecision: null,
    statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
    updatedAt: isoAgo({ ms: 41 * MINUTE }),
    body: GITHUB_PR_BODY,
    autoMergeRequest: null,
    headRefOid: 'a3f9c21',
    author: { login: 'marco-l', avatarUrl: null },
    reviewRequests: [{ login: 'dana-r' }],
  },
];

export const storyGithubIssues = (): ReadonlyArray<object> => [
  {
    number: 96,
    title: 'Bump decimal precision in ledger entries',
    body: 'Entries round to two decimals before the fee split. Move the split to four decimals and round once at the end.',
    url: 'https://github.com/harborline/ledger-core/issues/96',
    state: 'OPEN',
    labels: [{ name: 'ledger' }],
    assignees: [{ login: 'dana-r' }],
    author: { login: 'nadia-p' },
    updatedAt: isoAgo({ ms: DAY }),
  },
];

type MrParams = {
  readonly id: number;
  readonly iid: number;
  readonly title: string;
  readonly description: string;
  readonly branch: string;
  readonly author: string;
  readonly ago: number;
};

const mergeRequestOf = ({
  id,
  iid,
  title,
  description,
  branch,
  author,
  ago,
}: MrParams): GitlabMergeRequest => ({
  id,
  iid,
  projectId: 7,
  title,
  description,
  state: 'opened',
  webUrl: `https://gitlab.com/harborline/notify-relay/-/merge_requests/${iid}`,
  sourceBranch: branch,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: isoAgo({ ms: ago }),
  author: { username: author, name: author, avatarUrl: null },
});

export const storyGitlabMrs = (): ReadonlyArray<GitlabMergeRequest> => [
  mergeRequestOf({
    id: 4401,
    iid: 44,
    title: 'Retry SMS sends with backoff',
    description:
      'Failed SMS sends retry three times with exponential backoff, then land in the dead letter list.',
    branch: 'marco-l/sms-backoff',
    author: 'marco-l',
    ago: 5 * HOUR,
  }),
  mergeRequestOf({
    id: 4101,
    iid: 41,
    title: 'Drop the legacy email template',
    description:
      'Removes the old receipt template and its tests. No sender uses it since the last migration.',
    branch: 'dana-r/drop-legacy-template',
    author: 'dana-r',
    ago: 3 * DAY,
  }),
];

export const storyGitlabIssues = (): ReadonlyArray<GitlabIssue> => [];

type SentryParams = {
  readonly id: string;
  readonly shortId: string;
  readonly slug: string;
  readonly title: string;
  readonly culprit: string;
  readonly count: string;
  readonly userCount: number;
  readonly ago: number;
};

const sentryIssueOf = ({
  id,
  shortId,
  slug,
  title,
  culprit,
  count,
  userCount,
  ago,
}: SentryParams): SentryIssue => ({
  id,
  project: { slug, name: slug },
  shortId,
  title,
  culprit,
  level: 'error',
  status: 'unresolved',
  count,
  userCount,
  firstSeen: isoAgo({ ms: ago + 2 * DAY }),
  lastSeen: isoAgo({ ms: ago }),
  permalink: `https://example.invalid/sentry/issues/${id}/`,
  metadata: null,
});

export const STORY_SENTRY_NEW_ID = '7001';

export const storySentryIssues = (): ReadonlyArray<SentryIssue> => [
  sentryIssueOf({
    id: STORY_SENTRY_NEW_ID,
    shortId: 'PAY-API-7K1',
    slug: 'payments-api',
    title: 'DuplicateCreditError: credit already posted for delivery',
    culprit: 'webhooks.post_credit',
    count: '42',
    userCount: 9,
    ago: 8 * MINUTE,
  }),
  sentryIssueOf({
    id: '7002',
    shortId: 'LED-CORE-3QD',
    slug: 'ledger-core',
    title: 'TimeoutError in settle_batch',
    culprit: 'settle.settle_batch',
    count: '6',
    userCount: 1,
    ago: 2 * HOUR,
  }),
];

export const storySentryDetail = (): SentryIssueDetail => ({
  title: 'DuplicateCreditError: credit already posted for delivery',
  culprit: 'webhooks.post_credit',
  frames: [
    { filename: 'payments/webhooks.py', function: 'post_credit', line_no: 118, in_app: true },
    { filename: 'ledger/credits.py', function: 'apply_credit', line_no: 64, in_app: true },
    { filename: 'ledger/db.py', function: 'insert_entry', line_no: 201, in_app: true },
  ],
  tags: [{ key: 'environment', value: 'production' }],
  breadcrumbs: [],
});

export const STORY_SLACK_CHANNELS: ReadonlyArray<SlackChannel> = [
  {
    id: 'demo-story-channel-payments',
    name: 'payments',
    isMember: true,
    topic: null,
    memberCount: 14,
  },
  {
    id: 'demo-story-channel-releases',
    name: 'releases',
    isMember: true,
    topic: null,
    memberCount: 31,
  },
];

export const STORY_SLACK_USERS: ReadonlyArray<SlackUser> = [
  { id: 'demo-story-user-nadia', name: 'nadia-p', isBot: false, isDeleted: false, avatarUrl: null },
  { id: 'demo-story-user-marco', name: 'marco-l', isBot: false, isDeleted: false, avatarUrl: null },
  { id: 'demo-story-user-dana', name: 'dana-r', isBot: false, isDeleted: false, avatarUrl: null },
];

type ThreadParams = {
  readonly userId: string;
  readonly text: string;
  readonly replyCount: number;
  readonly ago: number;
};

const slackHeadOf = ({ userId, text, replyCount, ago }: ThreadParams): SlackMessage => ({
  ts: slackTs({ ms: ago }),
  threadTs: null,
  userId,
  botId: null,
  text,
  subtype: null,
  replyCount,
  replyUserCount: replyCount,
  postedAt: brandId<IsoDateTime>({ value: isoAgo({ ms: ago }) }),
  latestReplyAt: null,
  reactions: [],
});

type HeadsParams = {
  readonly channelId: string;
};

export const storySlackHeads = ({ channelId }: HeadsParams): ReadonlyArray<SlackMessage> => {
  if (channelId === 'demo-story-channel-payments') {
    return [
      slackHeadOf({
        userId: 'demo-story-user-nadia',
        text: 'Seeing double credits on two accounts this morning. Same delivery id on both rows.',
        replyCount: 1,
        ago: 20 * MINUTE,
      }),
    ];
  }
  return [
    slackHeadOf({
      userId: 'demo-story-user-marco',
      text: 'Cutting 2.18 once the retry fix is in. Anything else that should ride along?',
      replyCount: 0,
      ago: HOUR,
    }),
  ];
};

type ThreadReplyParams = {
  readonly head: SlackMessage | undefined;
  readonly channelId: string;
};

export const storySlackThread = ({
  head,
  channelId,
}: ThreadReplyParams): ReadonlyArray<SlackMessage> => {
  if (head === undefined) {
    return [];
  }
  if (channelId !== 'demo-story-channel-payments') {
    return [head];
  }
  return [
    head,
    {
      ...head,
      ts: `${Number.parseInt(head.ts, 10) + 120}.000200`,
      threadTs: head.ts,
      userId: 'demo-story-user-dana',
      text: 'Looks like the retry path. I have HBL-412 open for it.',
      replyCount: 0,
      replyUserCount: 0,
    },
  ];
};

export const storyKnownTaskKeys = (): ReadonlyArray<string> => [
  ...storyLinearIssues().map((issue) => `linear:issue:${issue.id}`),
  'github:pr:318',
  'github:issue:96',
  ...storyGitlabMrs().map((mr) => `gitlab:mr:${mr.id}`),
  'sentry:error:7002',
  ...storySlackHeads({ channelId: 'demo-story-channel-releases' }).map(
    (head) => `slack:thread:demo-story-channel-releases:${head.threadTs ?? head.ts}`,
  ),
];

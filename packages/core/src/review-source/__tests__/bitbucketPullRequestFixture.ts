import type { PullRequestFailureKind } from '../pullRequestPort';
import { PullRequestPortError } from '../pullRequestPort';
import type { BitbucketPullRequestTransport } from '../bitbucketPullRequestPort';
import type {
  BitbucketMergeStrategy,
  BitbucketPortCommit,
  BitbucketPortParticipant,
  BitbucketPortPullRequest,
  BitbucketPortStatus,
  BitbucketPortUser,
} from '../bitbucketPullRequestTypes';

export const BITBUCKET_PR_URL = 'https://bitbucket.org/harborline/payments-api/pull-requests/42';

const user = (nickname: string, displayName: string): BitbucketPortUser => ({
  uuid: `{${nickname}-uuid}`,
  nickname,
  displayName,
  avatarUrl: null,
});

export const NADIA = user('nadia-p', 'Nadia Petrova');
export const KENJI = user('kenji-w', 'Kenji Watanabe');
export const OMAR = user('omar-t', 'Omar Tran');
export const PRIYA = user('priya-n', 'Priya Nair');

export const participant = (
  member: BitbucketPortUser,
  overrides: Partial<BitbucketPortParticipant> = {},
): BitbucketPortParticipant => ({
  user: member,
  role: 'REVIEWER',
  approved: false,
  state: null,
  ...overrides,
});

export const pullRequest = (
  overrides: Partial<BitbucketPortPullRequest> = {},
): BitbucketPortPullRequest => ({
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'OPEN',
  createdOn: '2026-09-26T08:00:00+00:00',
  updatedOn: '2026-10-06T09:30:00+00:00',
  sourceBranch: 'hl/fix-duplicate-credit',
  sourceCommit: '6c20f48a9e1',
  destinationBranch: 'main',
  author: NADIA,
  participants: [
    participant(OMAR, { state: 'changes_requested' }),
    participant(KENJI, { approved: true, state: 'approved' }),
    participant(PRIYA),
    participant(NADIA, { role: 'PARTICIPANT' }),
  ],
  webUrl: BITBUCKET_PR_URL,
  ...overrides,
});

export const status = (overrides: Partial<BitbucketPortStatus> = {}): BitbucketPortStatus => ({
  key: 'PIPELINE',
  name: 'unit',
  state: 'SUCCESSFUL',
  url: 'https://bitbucket.org/harborline/payments-api/pipelines/1',
  createdOn: '2026-10-06T09:00:00+00:00',
  updatedOn: '2026-10-06T09:02:00+00:00',
  ...overrides,
});

export const COMMITS: ReadonlyArray<BitbucketPortCommit> = [
  {
    hash: '6c20f48a9e1',
    message: 'Key the credit guard on the event id',
    date: '2026-09-26T07:50:00+00:00',
    author: 'nadia-p',
  },
  {
    hash: 'a41c9e2b7d3',
    message: 'Drop the seenEvents read',
    date: '2026-10-03T12:00:00+00:00',
    author: 'nadia-p',
  },
];

const FILE_NAMES = [
  'src/ledger/ledgerClient.ts',
  'src/ledger/postCredit.ts',
  'src/webhooks/applyWebhook.ts',
  'src/webhooks/seenEvents.ts',
  'test/applyWebhook.test.ts',
  'docs/webhooks.md',
  'src/ledger/types.ts',
  'src/ledger/index.ts',
];

export const DIFF = FILE_NAMES.map((path) =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,2 +1,3 @@',
    ' keep',
    '-old',
    '+new',
    '+newer',
    '',
  ].join('\n'),
).join('');

export const MEMBERS: ReadonlyArray<BitbucketPortUser> = [NADIA, KENJI, OMAR, PRIYA];

export type FakeBitbucketCalls = {
  readonly merges: Array<BitbucketMergeStrategy>;
  readonly updates: Array<{
    readonly title?: string;
    readonly description?: string;
    readonly reviewerUuids?: ReadonlyArray<string>;
  }>;
  declines: number;
  readonly searches: Array<string>;
};

export type FakeBitbucketOptions = Readonly<{
  failWrites?: Readonly<{ kind: PullRequestFailureKind; text: string }>;
  failStatuses?: Readonly<{ kind: PullRequestFailureKind; text: string }>;
  failCommits?: boolean;
  statuses?: ReadonlyArray<BitbucketPortStatus>;
  pullRequest?: BitbucketPortPullRequest;
}>;

const failure = ({
  kind,
  text,
}: {
  readonly kind: PullRequestFailureKind;
  readonly text: string;
}): PullRequestPortError => new PullRequestPortError({ kind, message: text, details: text });

export const fakeBitbucketTransport = (
  options: FakeBitbucketOptions = {},
): { readonly transport: BitbucketPullRequestTransport; readonly calls: FakeBitbucketCalls } => {
  const calls: FakeBitbucketCalls = { merges: [], updates: [], declines: 0, searches: [] };
  const write = async (): Promise<void> => {
    if (options.failWrites !== undefined) {
      throw failure(options.failWrites);
    }
  };
  const transport: BitbucketPullRequestTransport = {
    readPullRequest: async () => options.pullRequest ?? pullRequest(),
    readStatuses: async () => {
      if (options.failStatuses !== undefined) {
        throw failure(options.failStatuses);
      }
      return options.statuses ?? [status(), status({ key: 'LINT', name: 'lint', state: 'FAILED' })];
    },
    readCommits: async () => {
      if (options.failCommits === true) {
        throw failure({ kind: 'failed', text: 'commits unavailable' });
      }
      return COMMITS;
    },
    readDiff: async () => DIFF,
    updatePullRequest: async (params) => {
      await write();
      calls.updates.push(params);
    },
    merge: async ({ strategy }) => {
      await write();
      calls.merges.push(strategy);
    },
    decline: async () => {
      await write();
      calls.declines += 1;
    },
    searchMembers: async ({ query }) => {
      calls.searches.push(query);
      const needle = query.trim().toLowerCase();
      return MEMBERS.filter(
        (member) =>
          needle === '' ||
          member.nickname.toLowerCase().includes(needle) ||
          member.displayName.toLowerCase().includes(needle),
      );
    },
  };
  return { transport, calls };
};

import { vi } from 'vitest';
import type { PrMergeMethod } from '@goodboy/types';
import type {
  GitlabApprovalsPayload,
  GitlabChecksPayload,
  GitlabCommitPayload,
  GitlabMergeRequestPayload,
  GitlabMergeSettingsPayload,
  GitlabPersonPayload,
  GitlabPullRequestTransport,
} from '../gitlabPullRequestPort';

export const GITLAB_MR_URL = 'https://gitlab.com/harborline/payments-api/-/merge_requests/42';

const person = ({
  id,
  username,
  name,
}: {
  readonly id: number;
  readonly username: string;
  readonly name: string;
}): GitlabPersonPayload => ({ id, username, name, avatarUrl: null });

export const NADIA = person({ id: 3, username: 'nadia-p', name: 'Nadia Petrova' });
export const OMAR = person({ id: 4, username: 'omar-t', name: 'Omar Tan' });
export const KENJI = person({ id: 7, username: 'kenji-w', name: 'Kenji Watanabe' });
export const PRIYA = person({ id: 8, username: 'priya-n', name: 'Priya Nair' });

export const MR_JSON: GitlabMergeRequestPayload = {
  iid: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'opened',
  webUrl: GITLAB_MR_URL,
  sourceBranch: 'hl/fix-duplicate-credit',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-10-06T09:30:00Z',
  createdAt: '2026-09-26T08:00:00Z',
  sha: '6c20f48a9e1',
  mergedAt: null,
  author: NADIA,
  reviewers: [OMAR, KENJI, PRIYA],
};

export const APPROVALS_JSON: GitlabApprovalsPayload = {
  approvalsLeft: 1,
  approvedBy: [{ user: KENJI }],
};

export const COMMITS_JSON: ReadonlyArray<GitlabCommitPayload> = [
  {
    id: 'a41c9e2b7d3f',
    title: 'Drop the seenEvents read',
    authorName: 'Nadia Petrova',
    committedDate: '2026-10-03T12:00:00Z',
  },
  {
    id: '6c20f48a9e1c',
    title: 'Key the credit guard on the event id',
    authorName: 'Nadia Petrova',
    committedDate: '2026-09-26T07:50:00Z',
  },
];

export const CHECKS_JSON: GitlabChecksPayload = {
  pipeline: { id: 9001, status: 'failed' },
  jobs: [
    {
      id: 77,
      name: 'unit',
      status: 'success',
      webUrl: 'https://gitlab.com/harborline/payments-api/-/jobs/77',
      allowFailure: false,
      duration: 83.5,
    },
    {
      id: 78,
      name: 'lint',
      status: 'failed',
      webUrl: 'https://gitlab.com/harborline/payments-api/-/jobs/78',
      allowFailure: false,
      duration: 12,
    },
  ],
};

export const SETTINGS_JSON: GitlabMergeSettingsPayload = {
  mergeMethod: 'merge',
  squashOption: 'default_off',
  onlyAllowMergeIfPipelineSucceeds: false,
};

const FILE_PATHS = [
  'src/ledger/ledgerClient.ts',
  'src/ledger/postCredit.ts',
  'src/webhooks/applyWebhook.ts',
  'src/webhooks/seenEvents.ts',
  'test/applyWebhook.test.ts',
  'docs/webhooks.md',
  'src/ledger/types.ts',
  'src/ledger/index.ts',
];

export const CHANGES_TEXT = FILE_PATHS.map(
  (path) =>
    `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,2 +1,3 @@\n keep\n-old\n+new\n+more\n`,
).join('');

export type TransportOverrides = Partial<{
  mr: GitlabMergeRequestPayload;
  approvals: GitlabApprovalsPayload | null;
  checks: GitlabChecksPayload | null;
  settings: GitlabMergeSettingsPayload;
  users: ReadonlyArray<GitlabPersonPayload>;
  writeError: Error;
  readError: Error;
}>;

export type FakeTransport = Readonly<{
  transport: GitlabPullRequestTransport;
  updates: Array<Parameters<GitlabPullRequestTransport['updateMergeRequest']>[0]>;
  states: Array<'close' | 'reopen'>;
  merges: Array<PrMergeMethod>;
  searches: Array<string>;
}>;

export const fakeGitlabTransport = (overrides: TransportOverrides = {}): FakeTransport => {
  const updates: FakeTransport['updates'] = [];
  const states: FakeTransport['states'] = [];
  const merges: FakeTransport['merges'] = [];
  const searches: FakeTransport['searches'] = [];
  const fail = (error: Error | undefined): void => {
    if (error !== undefined) {
      throw error;
    }
  };
  const transport: GitlabPullRequestTransport = {
    readMergeRequest: vi.fn(async () => {
      fail(overrides.readError);
      return overrides.mr ?? MR_JSON;
    }),
    readCommits: vi.fn(async () => COMMITS_JSON),
    readChanges: vi.fn(async () => CHANGES_TEXT),
    readApprovals: vi.fn(async () =>
      overrides.approvals === undefined ? APPROVALS_JSON : overrides.approvals,
    ),
    readPipelineJobs: vi.fn(async () =>
      overrides.checks === undefined ? CHECKS_JSON : overrides.checks,
    ),
    updateMergeRequest: vi.fn(async (params) => {
      fail(overrides.writeError);
      updates.push(params);
    }),
    setState: vi.fn(async ({ stateEvent }) => {
      fail(overrides.writeError);
      states.push(stateEvent);
    }),
    merge: vi.fn(async ({ method }) => {
      fail(overrides.writeError);
      merges.push(method);
    }),
    projectMergeSettings: vi.fn(async () => overrides.settings ?? SETTINGS_JSON),
    searchUsers: vi.fn(async ({ query }) => {
      searches.push(query);
      return overrides.users ?? [KENJI, PRIYA, OMAR];
    }),
  };
  return { transport, updates, states, merges, searches };
};

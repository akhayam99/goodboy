import { vi } from 'vitest';
import type { GhResult, GhRunner } from '../../github/gh';

export const GITHUB_PR_REPO = 'harborline/payments-api';
export const GITHUB_PR_URL = 'https://github.com/harborline/payments-api/pull/318';

export const PR_VIEW_JSON = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  body: 'Key the guard on the event id.\n\nCloses #412',
  url: GITHUB_PR_URL,
  state: 'OPEN',
  isDraft: false,
  author: { login: 'nadia-p', name: 'Nadia Petrova', is_bot: false },
  baseRefName: 'main',
  headRefName: 'hl/fix-duplicate-credit',
  headRefOid: '6c20f48a9e1',
  createdAt: '2026-09-26T08:00:00Z',
  updatedAt: '2026-10-06T09:30:00Z',
  mergedAt: null,
  mergeable: 'MERGEABLE',
  reviewDecision: 'REVIEW_REQUIRED',
  autoMergeRequest: null,
  closingIssuesReferences: [
    { number: 412, url: 'https://github.com/harborline/payments-api/issues/412' },
  ],
  commits: [
    {
      oid: '6c20f48a9e1',
      messageHeadline: 'Key the credit guard on the event id',
      committedDate: '2026-09-26T07:50:00Z',
      authors: [{ login: 'nadia-p', name: 'Nadia Petrova' }],
    },
    {
      oid: 'a41c9e2b7d3',
      messageHeadline: 'Drop the seenEvents read',
      committedDate: '2026-10-03T12:00:00Z',
      authors: [{ login: 'nadia-p', name: 'Nadia Petrova' }],
    },
  ],
  files: [
    { path: 'src/ledger/ledgerClient.ts', additions: 12, deletions: 4 },
    { path: 'src/ledger/postCredit.ts', additions: 18, deletions: 6 },
    { path: 'src/webhooks/applyWebhook.ts', additions: 34, deletions: 20 },
    { path: 'src/webhooks/seenEvents.ts', additions: 0, deletions: 11 },
    { path: 'test/applyWebhook.test.ts', additions: 22, deletions: 0 },
    { path: 'docs/webhooks.md', additions: 4, deletions: 1 },
    { path: 'src/ledger/types.ts', additions: 2, deletions: 0 },
    { path: 'src/ledger/index.ts', additions: 1, deletions: 0 },
  ],
};

export const REVIEWS_JSON = {
  reviews: [
    {
      id: 1,
      author: { login: 'kenji-w' },
      authorAssociation: 'MEMBER',
      body: 'The event id is the right key.',
      state: 'APPROVED',
      submittedAt: '2026-10-04T10:00:00Z',
    },
    {
      id: 2,
      author: { login: 'omar-t' },
      authorAssociation: 'MEMBER',
      body: 'Please drop the read.',
      state: 'CHANGES_REQUESTED',
      submittedAt: '2026-10-02T10:00:00Z',
    },
    {
      id: 3,
      author: { login: 'omar-t' },
      authorAssociation: 'MEMBER',
      body: 'Looks better.',
      state: 'COMMENTED',
      submittedAt: '2026-10-05T10:00:00Z',
    },
  ],
};

export const REQUESTS_JSON = {
  reviewRequests: [{ login: 'priya-n', avatarUrl: null }],
};

export const ROLLUP_JSON = {
  statusCheckRollup: [
    {
      name: 'unit',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      startedAt: '2026-10-06T09:00:00Z',
      completedAt: '2026-10-06T09:02:00Z',
      detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/1',
    },
    {
      name: 'lint',
      status: 'COMPLETED',
      conclusion: 'FAILURE',
      startedAt: '2026-10-06T09:00:00Z',
      completedAt: '2026-10-06T09:01:00Z',
      detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/2',
    },
  ],
};

export const REPO_METHODS_JSON = {
  squashMergeAllowed: true,
  mergeCommitAllowed: false,
  rebaseMergeAllowed: true,
};

export const COLLABORATORS_TSV = 'kenji-w\thttps://avatars.example/kenji\nomar-t\t\npriya-n\t\n';

export const jsonOk = (data: unknown): GhResult => ({
  stdout: JSON.stringify(data),
  stderr: '',
  exitCode: 0,
});

export const textOk = (stdout: string): GhResult => ({ stdout, stderr: '', exitCode: 0 });

export const failure = ({
  stderr,
  exitCode = 1,
}: {
  readonly stderr: string;
  readonly exitCode?: number;
}): GhResult => ({ stdout: '', stderr, exitCode });

export type RunnerOverride = (args: ReadonlyArray<string>) => GhResult | null;

export const githubRunner = ({
  override,
}: {
  readonly override?: RunnerOverride;
} = {}): { readonly runner: GhRunner; readonly calls: Array<ReadonlyArray<string>> } => {
  const calls: Array<ReadonlyArray<string>> = [];
  const runner: GhRunner = {
    run: vi.fn(async (args: ReadonlyArray<string>) => {
      calls.push(args);
      const forced = override?.(args) ?? null;
      if (forced !== null) {
        return forced;
      }
      const joined = args.join(' ');
      if (args[0] === 'repo' && args[1] === 'view') {
        return jsonOk(REPO_METHODS_JSON);
      }
      if (args[0] === 'api' && joined.includes('collaborators')) {
        return textOk(COLLABORATORS_TSV);
      }
      if (args[0] === 'pr' && args[1] === 'view') {
        if (joined.includes('closingIssuesReferences')) {
          return jsonOk(PR_VIEW_JSON);
        }
        if (joined.endsWith('--json reviews')) {
          return jsonOk(REVIEWS_JSON);
        }
        if (joined.endsWith('--json reviewRequests')) {
          return jsonOk(REQUESTS_JSON);
        }
        if (joined.endsWith('--json statusCheckRollup')) {
          return jsonOk(ROLLUP_JSON);
        }
      }
      if (args[0] === 'pr') {
        return textOk('');
      }
      return jsonOk([]);
    }),
  };
  return { runner, calls };
};

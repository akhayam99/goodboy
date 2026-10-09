import { checksBridge, type GhBridgeArgs } from './checks.runner';

const AUTHOR = { login: 'nadia-p', name: 'Nadia Petrova' };

const PR_VIEW = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  body: 'Key the guard on the event id.',
  url: 'https://example.invalid/harborline/payments-api/pull/318',
  state: 'OPEN',
  isDraft: false,
  author: AUTHOR,
  baseRefName: 'main',
  headRefName: 'hl/fix-duplicate-credit',
  headRefOid: 'a41c9e2b7d3',
  createdAt: '2026-09-04T08:00:00Z',
  updatedAt: '2026-09-04T10:00:00Z',
  mergedAt: null,
  mergeable: 'MERGEABLE',
  reviewDecision: 'APPROVED',
  autoMergeRequest: null,
  closingIssuesReferences: [],
  commits: [
    {
      oid: '6c20f48a9e1',
      messageHeadline: 'Key the credit guard on the event id',
      committedDate: '2026-09-04T07:50:00Z',
      authors: [AUTHOR],
    },
  ],
  files: [{ path: 'src/webhooks/applyWebhook.ts', additions: 34, deletions: 20 }],
};

const REPO_METHODS = {
  squashMergeAllowed: true,
  mergeCommitAllowed: false,
  rebaseMergeAllowed: true,
};

const writes: Array<ReadonlyArray<string>> = [];

export const ghWrites = (): ReadonlyArray<ReadonlyArray<string>> => writes;

export const clearGhWrites = (): void => {
  writes.length = 0;
};

const ok = ({ value }: { readonly value: unknown }) =>
  Promise.resolve({ stdout: JSON.stringify(value), stderr: '', exitCode: 0 });

const WRITE_VERBS: ReadonlySet<string> = new Set(['edit', 'merge', 'ready', 'close', 'reopen']);

export const pullRequestPageBridge = (
  command: string,
  payload?: GhBridgeArgs,
): Promise<unknown> => {
  if (command === 'worktree_status') {
    return checksBridge(command, payload).then((status) => ({
      ...(typeof status === 'object' && status !== null ? status : {}),
      upstream: 'origin/hl/fix-duplicate-credit',
      upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    }));
  }
  if (command !== 'gh_run') {
    return checksBridge(command, payload);
  }
  const args = payload?.args ?? [];
  if (
    args[0] === 'pr' &&
    args[1] === 'view' &&
    args.join(' ').includes('closingIssuesReferences')
  ) {
    return ok({ value: PR_VIEW });
  }
  if (args[0] === 'repo' && args[1] === 'view') {
    return ok({ value: REPO_METHODS });
  }
  if (args[0] === 'pr' && WRITE_VERBS.has(args[1] ?? '')) {
    writes.push(args);
    return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
  }
  return checksBridge(command, payload);
};

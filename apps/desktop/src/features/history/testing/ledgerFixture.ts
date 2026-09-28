import type { BranchCommit, HistoryGraph } from '@goodboy/types';

const commit = ({
  sha,
  subject,
  author,
  hoursAgo,
  pushed,
  parentSha,
}: {
  readonly sha: string;
  readonly subject: string;
  readonly author: string;
  readonly hoursAgo: number;
  readonly pushed: boolean;
  readonly parentSha: string;
}): BranchCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject,
  author,
  timestamp: 1_790_000_000 - hoursAgo * 3600,
  pushed,
  parentSha,
});

export const LEDGER_BASE = '9d4b1f7aa0000000000000000000000000000000';

export const LEDGER = {
  a: 'a1f3c20aa0000000000000000000000000000000',
  b: 'b7d9e41bb0000000000000000000000000000000',
  c: 'c4e8a12cc0000000000000000000000000000000',
  d: 'd2b6f90dd0000000000000000000000000000000',
  x: '8f2c6d1ee0000000000000000000000000000000',
  e: 'e9a1c37ff0000000000000000000000000000000',
  f: 'f5c7d0811000000000000000000000000000000',
} as const;

export const LEDGER_COMMITS: ReadonlyArray<BranchCommit> = [
  commit({
    sha: LEDGER.f,
    subject: 'Fix typo in CSV header',
    author: 'Tomas Vey',
    hoursAgo: 1,
    pushed: false,
    parentSha: LEDGER.e,
  }),
  commit({
    sha: LEDGER.e,
    subject: 'wip export tests',
    author: 'Tomas Vey',
    hoursAgo: 3,
    pushed: false,
    parentSha: LEDGER.x,
  }),
  commit({
    sha: LEDGER.x,
    subject: 'Add debug logging to the export',
    author: 'Tomas Vey',
    hoursAgo: 4,
    pushed: false,
    parentSha: LEDGER.d,
  }),
  commit({
    sha: LEDGER.d,
    subject: 'Add retries to the export job',
    author: 'Goodboy',
    hoursAgo: 5,
    pushed: false,
    parentSha: LEDGER.c,
  }),
  commit({
    sha: LEDGER.c,
    subject: 'Fix webhook signature check',
    author: 'Goodboy',
    hoursAgo: 24,
    pushed: true,
    parentSha: LEDGER.b,
  }),
  commit({
    sha: LEDGER.b,
    subject: 'Stream rows in batches of 500',
    author: 'Lena Arkwright',
    hoursAgo: 48,
    pushed: true,
    parentSha: LEDGER.a,
  }),
  commit({
    sha: LEDGER.a,
    subject: 'Add ledger export endpoint',
    author: 'Lena Arkwright',
    hoursAgo: 49,
    pushed: true,
    parentSha: LEDGER_BASE,
  }),
];

export const LEDGER_ORIGINAL: ReadonlyArray<string> = [...LEDGER_COMMITS]
  .reverse()
  .map((entry) => entry.sha);

export const LEDGER_GRAPH: HistoryGraph = {
  baseRef: 'origin/main',
  mergeBase: {
    sha: LEDGER_BASE,
    subject: 'Release 2.14',
    author: 'Lena Arkwright',
    timestamp: 1_790_000_000 - 50 * 3600,
  },
  mainHead: '7c21e0a110000000000000000000000000000000',
  mainCommits: [
    {
      sha: '7c21e0a110000000000000000000000000000000',
      subject: 'Merge #208: Cascadia rounding rules',
      author: 'Lena Arkwright',
      timestamp: 1_790_000_000 - 4 * 3600,
    },
    {
      sha: '5b90d3e220000000000000000000000000000000',
      subject: 'Rotate Acme sandbox keys',
      author: 'Tomas Vey',
      timestamp: 1_790_000_000 - 9 * 3600,
    },
    {
      sha: '3e44a1b330000000000000000000000000000000',
      subject: 'Bump notify-relay client',
      author: 'Goodboy',
      timestamp: 1_790_000_000 - 24 * 3600,
    },
  ],
  behind: 3,
  remoteSha: LEDGER.c,
  files: [
    { sha: LEDGER.f, files: ['export.ts'] },
    { sha: LEDGER.e, files: ['export.test.ts'] },
    { sha: LEDGER.x, files: ['logger.ts'] },
    { sha: LEDGER.d, files: ['export-job.ts', 'webhook.ts'] },
    { sha: LEDGER.c, files: ['webhook.ts'] },
    { sha: LEDGER.b, files: ['export.ts', 'batch.ts'] },
    { sha: LEDGER.a, files: ['export.ts'] },
  ],
};

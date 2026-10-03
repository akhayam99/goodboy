import type {
  BranchCommit,
  HistoryGraph,
  HistoryPlanPrediction,
  HistoryStep,
  PullRequestState,
} from '@goodboy/types';
import { historyBackupRef } from '../../../../../features/history/historyBackupRef';
import {
  combineInto,
  initialPlanItems,
  moveAbove,
  rewordStep,
  setVerb,
} from '../../../../../features/history/historyPlan';
import type { HistoryDraft, HistoryRun } from '../../../../../store/slices/history/types';
import type { MountGithubState } from '../../../../../store/types';
import { CTX_MOUNTS, CTX_PAYMENTS_ID, CTX_PAYMENTS_MOUNT_ID, CTX_SESSION_ID } from './contextBase';

const LEDGER_BRANCH = 'hl/ledger-export';

const hoursAgo = (hours: number): number =>
  Math.floor(Date.now() / 1000) - Math.round(hours * 3600);

const SHA = {
  a: 'a1f3c20b8e4d6f1a3c5e7b9d0f2a4c6e8b1d3f5a',
  b: 'b7d9e41c2a6f8e0b4d6c8a1f3e5b7d9c0a2e4f6b',
  c: 'c4e8a12d6b0f3a5c7e9d1b3f5a7c9e0b2d4f6a8c',
  d: 'd2b6f90e4c8a1d3f5b7e9c0a2d4f6b8e1c3a5d7f',
  x: '8f2c6d1a5e9b3d7f1c4a6e8b0d2f4a6c8e1b3d5f',
  e: 'e9a1c37f1d5b9e3a7c1f4b6d8e0a2c4f6b8d1e3a',
  f: 'f5c7d08a2e6c0f4b8d2a5c7e9f1b3d5a7c9e2f4b',
} as const;

const BASE = '9d4b1f7c3e8a2d6b0f5a9c1e7d3b8f2a6c0e4d9b';
const MAIN = '7c21e0a4b8d2f6a0c4e8b2d6f0a4c8e2b6d0f4a8';

const commit = (
  sha: string,
  subject: string,
  author: string,
  hours: number,
  pushed: boolean,
  parentSha: string,
): BranchCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject,
  author,
  timestamp: hoursAgo(hours),
  pushed,
  parentSha,
});

const LEDGER_SCENE_COMMITS: ReadonlyArray<BranchCommit> = [
  commit(SHA.f, 'Fix typo in CSV header', 'Tomas Vey', 1, false, SHA.e),
  commit(SHA.e, 'wip export tests', 'Tomas Vey', 3, false, SHA.x),
  commit(SHA.x, 'Add debug logging to the export', 'Tomas Vey', 4, false, SHA.d),
  commit(SHA.d, 'Add retries to the export job', 'Goodboy', 5, false, SHA.c),
  commit(SHA.c, 'Fix webhook signature check', 'Goodboy', 26, true, SHA.b),
  commit(SHA.b, 'Stream rows in batches of 500', 'Lena Arkwright', 50, true, SHA.a),
  commit(SHA.a, 'Add ledger export endpoint', 'Lena Arkwright', 52, true, BASE),
];

const LEDGER_SCENE_GRAPH: HistoryGraph = {
  baseRef: 'origin/main',
  mergeBase: {
    sha: BASE,
    subject: 'Release 2.14',
    author: 'Lena Arkwright',
    timestamp: hoursAgo(53),
  },
  mainHead: MAIN,
  mainCommits: [
    {
      sha: MAIN,
      subject: 'Merge #208: Cascadia rounding rules',
      author: 'Lena Arkwright',
      timestamp: hoursAgo(4),
    },
    {
      sha: '5b90d3e1f5a9c3e7b1d5f9a3c7e1b5d9f3a7c1e5',
      subject: 'Rotate Acme sandbox keys',
      author: 'Tomas Vey',
      timestamp: hoursAgo(9),
    },
    {
      sha: '3e44a1b7c1e5a9d3f7b1c5e9a3d7f1b5c9e3a7d1',
      subject: 'Bump notify-relay client',
      author: 'Goodboy',
      timestamp: hoursAgo(24),
    },
  ],
  behind: 3,
  remoteSha: SHA.c,
  files: [
    { sha: SHA.f, files: ['export.ts'] },
    { sha: SHA.e, files: ['export.test.ts'] },
    { sha: SHA.x, files: ['logger.ts'] },
    { sha: SHA.d, files: ['export-job.ts', 'webhook.ts'] },
    { sha: SHA.c, files: ['webhook.ts'] },
    { sha: SHA.b, files: ['export.ts', 'batch.ts'] },
    { sha: SHA.a, files: ['export.ts'] },
  ],
};

const LEDGER_SCENE_PLAN: ReadonlyArray<HistoryStep> = [
  (items: ReadonlyArray<HistoryStep>) =>
    combineInto({ items, sha: SHA.f, target: SHA.a, mode: 'fixup' }),
  (items: ReadonlyArray<HistoryStep>) => moveAbove({ items, sha: SHA.d, anchor: SHA.b }),
  (items: ReadonlyArray<HistoryStep>) =>
    combineInto({ items, sha: SHA.e, target: SHA.d, mode: 'squash' }),
  (items: ReadonlyArray<HistoryStep>) =>
    rewordStep({
      items,
      sha: SHA.c,
      message: 'Verify webhook signatures before crediting',
      original: 'Fix webhook signature check',
    }),
  (items: ReadonlyArray<HistoryStep>) => setVerb({ items, sha: SHA.x, verb: 'drop' }),
].reduce((items, apply) => apply(items), initialPlanItems({ commits: LEDGER_SCENE_COMMITS }));

export const LEDGER_SCENE_GROUP_PLAN: ReadonlyArray<HistoryStep> = [
  (items: ReadonlyArray<HistoryStep>) => moveAbove({ items, sha: SHA.d, anchor: SHA.b }),
  (items: ReadonlyArray<HistoryStep>) =>
    combineInto({ items, sha: SHA.x, target: SHA.d, mode: 'fixup' }),
  (items: ReadonlyArray<HistoryStep>) =>
    combineInto({ items, sha: SHA.e, target: SHA.d, mode: 'squash' }),
  (items: ReadonlyArray<HistoryStep>) =>
    combineInto({ items, sha: SHA.f, target: SHA.d, mode: 'fixup' }),
  (items: ReadonlyArray<HistoryStep>) =>
    rewordStep({
      items,
      sha: SHA.c,
      message: 'Verify webhook signatures before crediting',
      original: 'Fix webhook signature check',
    }),
].reduce((items, apply) => apply(items), initialPlanItems({ commits: LEDGER_SCENE_COMMITS }));

const conflictPrediction = ({
  items,
}: {
  readonly items: ReadonlyArray<HistoryStep>;
}): HistoryPlanPrediction => {
  const conflictAt = items.findIndex((step) => step.sha === SHA.d);
  return {
    isSupported: true,
    steps: items.map((step, index) => ({
      sha: step.sha,
      outcome:
        step.verb === 'drop'
          ? 'dropped'
          : index === conflictAt
            ? 'conflict'
            : index > conflictAt
              ? 'blocked'
              : 'clean',
      files: index === conflictAt ? ['webhook.ts'] : [],
      newSha: null,
    })),
    head: null,
    isTreeEqual: false,
    changedFiles: [],
  };
};

export const ledgerDraft = ({
  commits = LEDGER_SCENE_COMMITS,
  items = LEDGER_SCENE_PLAN,
  graph = LEDGER_SCENE_GRAPH,
  hasConflict = true,
}: {
  readonly commits?: ReadonlyArray<BranchCommit>;
  readonly items?: ReadonlyArray<HistoryStep>;
  readonly graph?: HistoryGraph;
  readonly hasConflict?: boolean;
}): HistoryDraft => ({
  sessionId: CTX_SESSION_ID,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  planId: 'mock-ledger-history-plan',
  branch: LEDGER_BRANCH,
  baseSha: BASE,
  headSha: commits[0]?.sha ?? BASE,
  commits,
  items,
  onto: null,
  graph,
  undo: [],
  prediction: hasConflict
    ? conflictPrediction({ items })
    : { isSupported: true, steps: [], head: null, isTreeEqual: true, changedFiles: [] },
  isPredicting: false,
  loadError: null,
});

const RESULT_SHA = {
  c: '858fe65b1d5f9a3c7e1b5d9f3a7c1e5b9d3f7a1c',
  d: '88a96c8d2f6a0c4e8b2d6f0a4c8e2b6d0f4a8c2e',
  b: '1b18740c3e7a1d5f9b3e7c1a5d9f3b7e1c5a9d3f',
  a: '97e0467e4a8c2f6b0d4a8e2c6f0b4d8a2e6c0f4b',
};

export const LEDGER_RESULT_COMMITS: ReadonlyArray<BranchCommit> = [
  commit(
    RESULT_SHA.c,
    'Verify webhook signatures before crediting',
    'Goodboy',
    26,
    true,
    RESULT_SHA.d,
  ),
  commit(RESULT_SHA.d, 'Add retries to the export job', 'Goodboy', 5, true, RESULT_SHA.b),
  commit(RESULT_SHA.b, 'Stream rows in batches of 500', 'Lena Arkwright', 50, true, RESULT_SHA.a),
  commit(RESULT_SHA.a, 'Add ledger export endpoint', 'Lena Arkwright', 52, true, BASE),
];

export const LEDGER_RESULT_GRAPH: HistoryGraph = {
  ...LEDGER_SCENE_GRAPH,
  remoteSha: RESULT_SHA.c,
  files: [],
};

const baseRun = {
  sessionId: CTX_SESSION_ID,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  origin: 'plan',
  planId: 'mock-ledger-history-plan',
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: null,
  remoteSha: SHA.c,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  updatedAt: 0,
} satisfies Omit<HistoryRun, 'phase'>;

export const LEDGER_TRYING_RUN: HistoryRun = {
  ...baseRun,
  phase: 'trying',
  progress: { stage: 'step', index: 3, total: 7, sha: SHA.d },
};

export const LEDGER_STOPPED_RUN: HistoryRun = {
  ...baseRun,
  phase: 'stopped',
  stop: {
    reason: 'conflict',
    message:
      'Step 3 of 7, “Add retries to the export job”, conflicts in webhook.ts. The temporary copy was removed. Your branch is exactly as it was.',
    files: ['webhook.ts'],
    sha: SHA.d,
  },
};

export const LEDGER_RESULT_RUN: HistoryRun = {
  ...baseRun,
  phase: 'pushed',
  backupRef: historyBackupRef({ branch: LEDGER_BRANCH, atMs: Date.now() - 2 * 60_000 }),
  remoteSha: RESULT_SHA.c,
  applied: {
    before: 7,
    after: 4,
    lines: [
      {
        action: 'fixup',
        text: 'Folded “Fix typo in CSV header” into “Add ledger export endpoint”, keeping its title',
        sha: SHA.f,
        target: SHA.a,
      },
      {
        action: 'squash',
        text: 'Combined “wip export tests” with “Add retries to the export job”, both messages kept',
        sha: SHA.e,
        target: SHA.d,
      },
      {
        action: 'drop',
        text: 'Removed “Add debug logging to the export”',
        sha: SHA.x,
        target: null,
      },
      {
        action: 'move',
        text: 'Moved “Add retries to the export job” below “Verify webhook signatures before crediting”',
        sha: SHA.d,
        target: SHA.c,
      },
      {
        action: 'reword',
        text: 'Renamed “Fix webhook signature check” to “Verify webhook signatures before crediting”',
        sha: SHA.c,
        target: null,
      },
    ],
    includes: {
      [RESULT_SHA.d]: ['wip export tests'],
      [RESULT_SHA.a]: ['Fix typo in CSV header'],
    },
    absorbed: {
      [RESULT_SHA.d]: [{ sha: SHA.e, title: 'wip export tests', mode: 'squash' }],
      [RESULT_SHA.a]: [{ sha: SHA.f, title: 'Fix typo in CSV header', mode: 'fixup' }],
    },
    newShas: Object.values(RESULT_SHA),
    touchedOnline: 3,
    isSameCode: false,
    isOnMain: false,
    removedFiles: ['logger.ts'],
  },
};

const PR: PullRequestState = {
  number: 214,
  title: 'Export the ledger as CSV',
  url: 'https://example.invalid/harborline/payments-api/pull/214',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: LEDGER_BRANCH,
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: new Date().toISOString(),
  headSha: SHA.c,
};

export const ledgerGithub = ({ headSha }: { readonly headSha: string }): MountGithubState => ({
  pr: { ...PR, headSha },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  projectId: CTX_PAYMENTS_ID,
  revision: 1,
  repository: 'harborline/payments-api',
  host: 'github.com',
  branch: LEDGER_BRANCH,
  prs: [{ ...PR, headSha }],
  links: [],
});

export const LEDGER_MOUNTS = CTX_MOUNTS.map((mount) =>
  mount.mountId === CTX_PAYMENTS_MOUNT_ID ? { ...mount, branch: LEDGER_BRANCH } : mount,
);

export const LEDGER_HEAD_SHAS = { plan: SHA.c, result: RESULT_SHA.c } as const;

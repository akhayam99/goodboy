import type { BranchCommit, HistoryGraph, HistoryStep } from '@goodboy/types';
import { historyBackupRef } from '../../../../../features/history/historyBackupRef';
import { historyEditText } from '../../../../../features/history/historyEditText';
import {
  combineInto,
  initialPlanItems,
  rewordStep,
} from '../../../../../features/history/historyPlan';
import type {
  HistoryApplied,
  HistoryDraft,
  HistoryRun,
} from '../../../../../store/slices/history/types';
import { CTX_PAYMENTS_MOUNT_ID, CTX_SESSION_ID } from './contextBase';

const BRANCH = 'ak/ledger-batching-3f9a';
const TICKET = '[HBL-212]';
const OLD_TARGET = `feat: add ledger batching foundations ${TICKET}`;
const NEW_TARGET = `feat: ledger batching foundations ${TICKET}`;
const BASE = '1b6029c4e8a2d6f0b4c8e2a6d0f4b8c2e6a0d4f8';
const SQUASHED = 'f01f49a3c7e1b5d9f3a7c1e5b9d3f7a1c5e9b3d7';

const ABSORBED: ReadonlyArray<readonly [string, 'fixup' | 'squash']> = [
  ['test: merge related batch scenarios', 'fixup'],
  ['test: slim down batch writer tests', 'fixup'],
  ['test: cover the settlement retry path end to end', 'fixup'],
  ['refactor: let the ledger client expose the batch size', 'fixup'],
  ['refactor: name the settlement result param batchId', 'fixup'],
  ['refactor: drop the legacy flush route', 'fixup'],
  ['fix: retry batches outside the maintenance window', 'fixup'],
  ['refactor: drop the empty batch state', 'fixup'],
  ['refactor: colocate batching helpers with the writer', 'fixup'],
  ['test: drop direct tests of writer internals', 'fixup'],
  ['refactor: drop unused batch options', 'fixup'],
  ['refactor: rename BatchQueue to WriteQueue', 'fixup'],
  ['refactor: reuse retry copy for failed batches', 'fixup'],
  ['refactor: capture write errors at the call site', 'fixup'],
  ['refactor: drive batch sizes through one config entry', 'fixup'],
  ['feat: introduce the batch writer before its queue', 'squash'],
  ['refactor: drop flush from the sync hook', 'fixup'],
  ['feat: run the settlement flow in a single batch job', 'fixup'],
  ['feat: link retries from the notifier', 'fixup'],
  ['fix: hide partner endpoints outside the rollout', 'fixup'],
  ['feat: open the settlement endpoint to partners', 'fixup'],
  ['feat: show the batch result after submit', 'fixup'],
  ['feat: surface support contacts when a batch stalls', 'squash'],
  ['feat: ask for the batch size one field at a time', 'fixup'],
  ['feat: add a dry run flag to the writer', 'fixup'],
];

const hoursAgo = ({ hours }: { readonly hours: number }): number =>
  Math.floor(Date.now() / 1000) - Math.round(hours * 3600);

const shaOf = ({ index }: { readonly index: number }): string =>
  `${(index + 16).toString(16).padStart(2, '0')}c4a9e1`.padEnd(40, '0');

const OLDEST_SHA = shaOf({ index: 0 });

const commitAt = ({
  index,
  subject,
}: {
  readonly index: number;
  readonly subject: string;
}): BranchCommit => ({
  sha: shaOf({ index }),
  shortSha: shaOf({ index }).slice(0, 7),
  subject,
  author: index % 3 === 0 ? 'Mara Quint' : 'Theo Varga',
  timestamp: hoursAgo({ hours: 60 - index * 2 }),
  pushed: index < 10,
  parentSha: index === 0 ? BASE : shaOf({ index: index - 1 }),
});

const BEFORE_COMMITS: ReadonlyArray<BranchCommit> = [
  commitAt({ index: 0, subject: OLD_TARGET }),
  ...ABSORBED.map(([title], index) =>
    commitAt({ index: index + 1, subject: `${title} ${TICKET}` }),
  ),
].reverse();

const titleOf = (sha: string): string =>
  BEFORE_COMMITS.find((commit) => commit.sha === sha)?.subject ?? sha.slice(0, 7);

const PLAN: ReadonlyArray<HistoryStep> = rewordStep({
  items: ABSORBED.reduce(
    (items, [, mode], index) =>
      combineInto({ items, sha: shaOf({ index: index + 1 }), target: OLDEST_SHA, mode }),
    initialPlanItems({ commits: BEFORE_COMMITS }),
  ),
  sha: OLDEST_SHA,
  message: NEW_TARGET,
  original: OLD_TARGET,
});

const GRAPH: HistoryGraph = {
  baseRef: 'origin/main',
  mergeBase: {
    sha: BASE,
    subject: 'fix: ledger rounding in the nightly close [HBL-198] (#9883)',
    author: 'Ines Okafor',
    timestamp: hoursAgo({ hours: 72 }),
  },
  mainHead: BASE,
  mainCommits: [],
  behind: 0,
  remoteSha: shaOf({ index: 9 }),
  files: [],
};

const draftOf = ({
  commits,
  items,
}: {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly items: ReadonlyArray<HistoryStep>;
}): HistoryDraft => ({
  sessionId: CTX_SESSION_ID,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  planId: 'mock-squash-history-plan',
  branch: BRANCH,
  baseSha: BASE,
  headSha: commits[0]?.sha ?? BASE,
  commits,
  items,
  onto: null,
  graph: GRAPH,
  undo: [],
  prediction: {
    isSupported: true,
    steps: items.map((step) => ({ sha: step.sha, outcome: 'clean', files: [], newSha: null })),
    head: null,
    isTreeEqual: true,
    changedFiles: [],
  },
  isPredicting: false,
  loadError: null,
});

export const SQUASH_PLANNED_DRAFT = draftOf({ commits: BEFORE_COMMITS, items: PLAN });

const AFTER_COMMIT: BranchCommit = {
  sha: SQUASHED,
  shortSha: SQUASHED.slice(0, 7),
  subject: NEW_TARGET,
  author: 'Mara Quint',
  timestamp: hoursAgo({ hours: 60 }),
  pushed: false,
  parentSha: BASE,
};

export const SQUASH_APPLIED_DRAFT = draftOf({
  commits: [AFTER_COMMIT],
  items: initialPlanItems({ commits: [AFTER_COMMIT] }),
});

const APPLIED: HistoryApplied = {
  before: BEFORE_COMMITS.length,
  after: 1,
  lines: [
    ...ABSORBED.map(([, mode], index) => {
      const sha = shaOf({ index: index + 1 });
      return {
        action: mode,
        text: historyEditText({
          edit: { kind: mode, key: sha, sha, target: OLDEST_SHA },
          titleOf,
          targetTitleOf: (target: string) => (target === OLDEST_SHA ? NEW_TARGET : titleOf(target)),
        }),
        sha,
        target: OLDEST_SHA,
      };
    }),
    {
      action: 'reword',
      text: `Renamed “${OLD_TARGET}” to “${NEW_TARGET}”`,
      sha: OLDEST_SHA,
      target: null,
    },
  ],
  includes: { [SQUASHED]: ABSORBED.map(([title]) => `${title} ${TICKET}`) },
  absorbed: {
    [SQUASHED]: ABSORBED.map(([title, mode], index) => ({
      sha: shaOf({ index: index + 1 }),
      title: `${title} ${TICKET}`,
      mode,
    })),
  },
  newShas: [SQUASHED],
  touchedOnline: 10,
  isSameCode: true,
  isOnMain: false,
  removedFiles: [],
};

export const SQUASH_APPLIED_RUN: HistoryRun = {
  sessionId: CTX_SESSION_ID,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  origin: 'plan',
  phase: 'applied',
  planId: 'mock-squash-history-plan',
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: historyBackupRef({ branch: BRANCH, atMs: Date.now() - 60_000 }),
  remoteSha: shaOf({ index: 9 }),
  holder: null,
  progress: null,
  applied: APPLIED,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: null,
  updatedAt: 1,
};

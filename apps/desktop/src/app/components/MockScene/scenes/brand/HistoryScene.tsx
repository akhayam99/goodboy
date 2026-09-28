import type { HistoryGraph, HistoryPlanPrediction, HistoryStep } from '@goodboy/types';
import { combineInto, initialPlanItems } from '../../../../../features/history/historyPlan';
import type { HistoryDraft } from '../../../../../store/slices/history/types';
import { useSceneClicks } from '../audit/useSceneClicks';
import { BRAND_SESSION } from './canon';
import { CTX_PAYMENTS_MOUNT_ID, CTX_SESSION_ID } from './contextBase';
import { CTX_BASE_SHA, CTX_COMMITS } from './contextBranch';
import { HistorySceneShell } from './HistorySceneShell';

const hoursAgo = (hours: number): number => Math.floor(Date.now() / 1000) - hours * 3600;

const ITEMS: ReadonlyArray<HistoryStep> = [...CTX_COMMITS]
  .reverse()
  .reduce<ReadonlyArray<HistoryStep>>(
    (items, commit) => {
      const target = CTX_COMMITS.find(
        (candidate) => `fixup! ${candidate.subject}` === commit.subject,
      );
      return target === undefined
        ? items
        : combineInto({ items, sha: commit.sha, target: target.sha, mode: 'fixup' });
    },
    initialPlanItems({ commits: CTX_COMMITS }),
  );

const GRAPH: HistoryGraph = {
  baseRef: 'origin/main',
  mergeBase: {
    sha: CTX_BASE_SHA,
    subject: 'Release 4.8',
    author: 'Lena Arkwright',
    timestamp: hoursAgo(6),
  },
  mainHead: '2d6f0a4c8e2b6d0f4a8c2e6b0d4f8a2c6e0b4d8f',
  mainCommits: [
    {
      sha: '2d6f0a4c8e2b6d0f4a8c2e6b0d4f8a2c6e0b4d8f',
      subject: 'Bump notify-relay client',
      author: 'Goodboy',
      timestamp: hoursAgo(2),
    },
    {
      sha: '6b0d4f8a2c6e0b4d8f2a6c0e4b8d2f6a0c4e8b2d',
      subject: 'Rotate Acme sandbox keys',
      author: 'Tomas Vey',
      timestamp: hoursAgo(3),
    },
  ],
  behind: 2,
  remoteSha: CTX_COMMITS.find((commit) => commit.pushed)?.sha ?? null,
  files: [],
};

const PREDICTION: HistoryPlanPrediction = {
  isSupported: true,
  steps: ITEMS.map((step) => ({ sha: step.sha, outcome: 'clean', files: [], newSha: null })),
  head: null,
  isTreeEqual: true,
  changedFiles: [],
};

const DRAFT: HistoryDraft = {
  sessionId: CTX_SESSION_ID,
  mountId: CTX_PAYMENTS_MOUNT_ID,
  planId: 'mock-brand-history-plan',
  branch: BRAND_SESSION.branch,
  baseSha: CTX_BASE_SHA,
  headSha: CTX_COMMITS[0]?.sha ?? CTX_BASE_SHA,
  commits: CTX_COMMITS,
  items: ITEMS,
  onto: null,
  graph: GRAPH,
  undo: [],
  prediction: PREDICTION,
  isPredicting: false,
  loadError: null,
};

const CLICKS: ReadonlyArray<string> = ['More history actions', 'Backups'];

export const BrandHistoryScene = () => {
  useSceneClicks({
    isReady: true,
    labels: CLICKS,
    selector: 'button, [role="menuitem"]',
    match: 'prefix',
    intervalMs: 300,
  });
  return <HistorySceneShell draft={DRAFT} run={null} github={null} isLedger={false} />;
};

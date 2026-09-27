import { useEffect, useState } from 'react';
import type { HistoryPlanPrediction, HistoryStep } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { HistoryDraft } from '../../../../../store/slices/history/types';
import { ShellFrame } from '../shellChrome';
import { useSceneClicks } from '../audit/useSceneClicks';
import { BRAND_SESSION } from './canon';
import { CTX_PAYMENTS_MOUNT_ID, CTX_SESSION, CTX_SESSION_ID, seedContextBase } from './contextBase';
import { CTX_BASE_SHA, CTX_COMMITS } from './contextBranch';
import { HistoryStage } from './HistoryStage';

const SQUASHED = new Set(
  CTX_COMMITS.filter((commit) => commit.subject.startsWith('fixup! ')).map((commit) => commit.sha),
);

const ITEMS: ReadonlyArray<HistoryStep> = [...CTX_COMMITS]
  .reverse()
  .map((commit) => ({ sha: commit.sha, verb: SQUASHED.has(commit.sha) ? 'squash' : 'pick' }));

const NEW_SHAS: ReadonlyArray<string> = [
  'b27e4c9a1d5f3b8e0c6a2d4f7b9e1c3a5d8f0b2e',
  'd61a3f8c2e7b9d4a0f5c1e8b3d6a9f2c4e7b0d1a',
  'f09c5e2a8d3b7f1c6e4a9d0b2f5c8e1a3d7b9f4c',
];

const PREDICTION: HistoryPlanPrediction = {
  isSupported: true,
  steps: ITEMS.map((step, index) => ({
    sha: step.sha,
    outcome: 'clean',
    files: [],
    newSha:
      step.verb === 'squash' ? null : (NEW_SHAS[Math.min(index, NEW_SHAS.length - 1)] ?? null),
  })),
  head: NEW_SHAS[NEW_SHAS.length - 1] ?? null,
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
  prediction: PREDICTION,
  isPredicting: false,
  lastEdit: null,
  conflictEdit: null,
  loadError: null,
};

const CLICKS: ReadonlyArray<string> = ['More history actions', 'Backups'];

export const BrandHistoryScene = () => {
  const [isReady, setIsReady] = useState(false);
  const [isStaged, setIsStaged] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'files' });
    useAppStore.setState({
      diffFocus: {},
      diffPage: { [CTX_SESSION_ID]: 'history' },
      historyDrafts: { [CTX_PAYMENTS_MOUNT_ID]: DRAFT },
      historyRuns: {},
      loadHistoryDraft: async () => undefined,
      hasPushedHistoryBefore: async () => true,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) {
      setIsStaged(true);
    }
  }, [isReady]);

  useSceneClicks({
    isReady: isStaged,
    labels: CLICKS,
    selector: 'button, [role="menuitem"]',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CTX_SESSION} main={isStaged ? <HistoryStage /> : null} />;
};

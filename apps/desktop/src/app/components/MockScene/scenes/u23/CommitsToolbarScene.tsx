import { useEffect } from 'react';
import type { MountId } from '@goodboy/types';
import { initialPlanItems } from '../../../../../features/history/historyPlan';
import { useAppStore } from '../../../../../store';
import type { HistoryDraft } from '../../../../../store/slices/history/types';
import { CTX_BASE_SHA, CTX_COMMITS } from '../brand/contextBranch';
import { SESSION_ID } from '../resolveSeed';
import { U21_BRANCH_SCENES } from '../u21/branch';

const FIX_MOUNT_ID = 'mock-u21-mount-fix-duplicate-credit' as MountId;

const COMMITS_DRAFT: HistoryDraft = {
  sessionId: SESSION_ID,
  mountId: FIX_MOUNT_ID,
  planId: 'mock-u23-commits-plan',
  branch: 'hl/fix-duplicate-credit',
  baseSha: CTX_BASE_SHA,
  headSha: CTX_COMMITS[0]?.sha ?? CTX_BASE_SHA,
  commits: CTX_COMMITS,
  items: initialPlanItems({ commits: CTX_COMMITS }),
  onto: null,
  graph: null,
  undo: [],
  prediction: null,
  isPredicting: false,
  loadError: null,
};

const BranchSceneBase = U21_BRANCH_SCENES['branch-description-open'];

export const CommitsToolbarScene = () => {
  useEffect(() => {
    useAppStore.setState((state) => ({
      branchTab: { ...state.branchTab, [SESSION_ID]: 'commits' },
      historyDrafts: { ...state.historyDrafts, [FIX_MOUNT_ID]: COMMITS_DRAFT },
      loadHistoryDraft: async () => undefined,
    }));
  }, []);
  return <BranchSceneBase />;
};

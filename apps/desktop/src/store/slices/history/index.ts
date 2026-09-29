import { applyHistoryRewrite, pushHistoryRewrite } from './applyHistoryRewrite';
import {
  applyHistoryDraft,
  applyRewrittenHistory,
  dismissHistoryRun,
  rewriteDraftWithAgent,
} from './applyHistoryDraft';
import {
  discardHistoryDraft,
  editHistoryDraft,
  loadHistoryDraft,
  undoHistoryDraft,
} from './historyDrafts';
import { rebaseBranch } from './rebaseBranch';
import { bringOriginIntoHistory } from './bringOriginIntoHistory';
import { restoreHistory } from './restoreHistory';
import { settleHistoryRewriter } from './settleHistoryRewriter';
import { startHistoryRewriter } from './startHistoryRewriter';
import { syncBranchWithRemote } from './syncBranchWithRemote';
import type { GetFn, SetFn } from './types';

export { historyInitialState } from './state';

export const createHistorySlice = (set: SetFn, get: GetFn) => {
  return {
    rebaseBranch: rebaseBranch(set, get),
    applyHistoryRewrite: applyHistoryRewrite(set, get),
    pushHistoryRewrite: pushHistoryRewrite(set, get),
    startHistoryRewriter: startHistoryRewriter(set, get),
    settleHistoryRewriter: settleHistoryRewriter(set, get),
    loadHistoryDraft: loadHistoryDraft(set, get),
    editHistoryDraft: editHistoryDraft(set, get),
    undoHistoryDraft: undoHistoryDraft(set, get),
    dismissHistoryRun: dismissHistoryRun(set, get),
    discardHistoryDraft: discardHistoryDraft(set, get),
    applyHistoryDraft: applyHistoryDraft(set, get),
    applyRewrittenHistory: applyRewrittenHistory(set, get),
    rewriteDraftWithAgent: rewriteDraftWithAgent(set, get),
    restoreHistory: restoreHistory(set, get),
    bringOriginIntoHistory: bringOriginIntoHistory(set, get),
    syncBranchWithRemote: syncBranchWithRemote(set, get),
  };
};

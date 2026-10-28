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
import { resumeHistoryMove } from './resumeHistoryMove';
import { bringBackHistoryFiles } from './bringBackHistoryFiles';
import { forgetHistoryFiles } from './forgetHistoryFiles';
import { acceptHistoryChange } from './acceptHistoryChange';
import { discardHistoryChange } from './discardHistoryChange';
import { fixPushWithAgent } from './fixPushWithAgent';
import { settlePushFix } from './settlePushFix';
import { fixBranchPushWithAgent } from './fixBranchPushWithAgent';
import { settleBranchPushFix } from './settleBranchPushFix';
import { claimPushFixOutcome } from './pushFix/claimPushFixOutcome';
import { dismissPushFixOutcome } from './pushFix/dismissPushFixOutcome';
import { notePushFixFollowUp } from './pushFix/notePushFixFollowUp';
import { prefillBranchPushTerminal } from './prefillBranchPushTerminal';
import { settleHistoryRewriter } from './settleHistoryRewriter';
import { startHistoryRewriter } from './startHistoryRewriter';
import { syncBranchWithRemote } from './syncBranchWithRemote';
import type { SliceDeps } from '../../slice-types';
import { changeLiveHistory } from './changeLiveHistory';
import { setHistoryLiveSession } from './setHistoryLiveSession';
import { clearLiveHistoryError } from './clearLiveHistoryError';
import { keepRebaseStop } from './keepRebaseStop';
import { adoptRebaseStop } from './adoptRebaseStop';
import { resolveRebaseMyself } from './resolveRebaseMyself';
import { bringOriginInAndPush } from './bringOriginInAndPush';

export { historyInitialState } from './state';

export const createHistorySlice = ({ set, get }: SliceDeps) => {
  return {
    changeLiveHistory: changeLiveHistory({ set, get }),
    setHistoryLiveSession: setHistoryLiveSession({ set, get }),
    clearLiveHistoryError: clearLiveHistoryError({ set, get }),
    rebaseBranch: rebaseBranch(set, get),
    acceptHistoryChange: acceptHistoryChange({ set, get }),
    discardHistoryChange: discardHistoryChange({ set, get }),
    applyHistoryRewrite: applyHistoryRewrite(set, get),
    pushHistoryRewrite: pushHistoryRewrite(set, get),
    startHistoryRewriter: startHistoryRewriter(set, get),
    settleHistoryRewriter: settleHistoryRewriter(set, get),
    fixPushWithAgent: fixPushWithAgent({ set, get }),
    settlePushFix: settlePushFix({ set, get }),
    fixBranchPushWithAgent: fixBranchPushWithAgent({ set, get }),
    settleBranchPushFix: settleBranchPushFix({ set, get }),
    claimPushFixOutcome: claimPushFixOutcome({ set, get }),
    dismissPushFixOutcome: dismissPushFixOutcome({ set, get }),
    notePushFixFollowUp: notePushFixFollowUp({ set, get }),
    prefillBranchPushTerminal: prefillBranchPushTerminal({ get }),
    loadHistoryDraft: loadHistoryDraft(set, get),
    editHistoryDraft: editHistoryDraft(set, get),
    undoHistoryDraft: undoHistoryDraft(set, get),
    dismissHistoryRun: dismissHistoryRun(set, get),
    keepRebaseStop: keepRebaseStop({ set, get }),
    adoptRebaseStop: adoptRebaseStop({ set, get }),
    resolveRebaseMyself: resolveRebaseMyself({ set, get }),
    bringOriginInAndPush: bringOriginInAndPush({ set, get }),
    discardHistoryDraft: discardHistoryDraft(set, get),
    applyHistoryDraft: applyHistoryDraft(set, get),
    applyRewrittenHistory: applyRewrittenHistory(set, get),
    rewriteDraftWithAgent: rewriteDraftWithAgent(set, get),
    restoreHistory: restoreHistory(set, get),
    resumeHistoryMove: resumeHistoryMove({ set, get }),
    bringBackHistoryFiles: bringBackHistoryFiles({ set, get }),
    forgetHistoryFiles: forgetHistoryFiles({ set, get }),
    bringOriginIntoHistory: bringOriginIntoHistory(set, get),
    syncBranchWithRemote: syncBranchWithRemote(set, get),
  };
};

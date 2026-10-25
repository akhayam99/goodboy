import type { MountId, SessionId } from '@goodboy/types';
import { captureStartHint } from '../startHints/captureStartHint';
import { START_HINT_SCOPES } from '../startHints/startHintScopes';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export type RebaseStopVerbs = {
  readonly resolveWithAuto: () => Promise<void>;
  readonly resolveMyself: () => Promise<void>;
  readonly keep: () => Promise<void>;
  readonly bringIn: () => Promise<void>;
  readonly undoRebase: () => Promise<void>;
  readonly retryRebase: () => Promise<void>;
  readonly fixPush: () => Promise<void>;
  readonly retryPush: () => Promise<void>;
};

export const rebaseStopVerbs = ({ get, sessionId, mountId }: Params): RebaseStopVerbs => ({
  resolveWithAuto: async () => {
    const state = get();
    const capture = captureStartHint({
      state,
      sessionId,
      scope: START_HINT_SCOPES.rebase({ mountId }),
    });
    await state.resolveRebaseWithAuto({
      sessionId,
      mountIds: [mountId],
      hint: capture.text,
      onAccepted: () => get().settleStartHint({ capture }),
    });
  },
  resolveMyself: async () => {
    await get().resolveRebaseMyself({ sessionId, mountId });
  },
  keep: () => get().keepRebaseStop({ sessionId, mountId }),
  bringIn: async () => {
    await get().bringOriginInAndPush({ sessionId, mountId });
  },
  undoRebase: async () => {
    const state = get();
    const run = state.adoptRebaseStop({ sessionId, mountId });
    if (run === null || run.backupRef === null) {
      return;
    }
    await state.restoreHistory({
      sessionId,
      mountId,
      backupRef: run.backupRef,
      shouldPush: false,
    });
  },
  retryRebase: async () => {
    await get().rebaseBranch({ sessionId, mountId });
  },
  fixPush: () => {
    const state = get();
    state.adoptRebaseStop({ sessionId, mountId });
    const capture = captureStartHint({
      state,
      sessionId,
      scope: START_HINT_SCOPES.pushFix({ mountId }),
    });
    return state.fixPushWithAgent({
      sessionId,
      mountId,
      hint: capture.text,
      onAccepted: () => state.settleStartHint({ capture }),
    });
  },
  retryPush: async () => {
    const state = get();
    const run = state.historyRuns[mountId];
    if (run === undefined) {
      return;
    }
    await state.pushHistoryRewrite({
      sessionId,
      mountId,
      origin: run.origin,
      planId: run.planId,
      expectedRemoteSha: run.remoteSha,
      identity: run.identity,
    });
    await state.loadHistoryDraft({ sessionId, mountId });
  },
});

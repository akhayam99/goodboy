import type { HistoryBackup, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { HistoryRun } from '../../../../../store/slices/history/types';
import {
  usePendingAction,
  type PendingActionRun,
} from '../../../../../shared/hooks/usePendingAction';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly hasUpstream: boolean;
};

export const useHistoryRunFlow = ({ sessionId, mountId, hasUpstream }: Params) => {
  const history = usePendingAction({ sessionId });
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);
  const discardHistoryDraft = useAppStore((s) => s.discardHistoryDraft);
  const applyHistoryDraft = useAppStore((s) => s.applyHistoryDraft);
  const applyRewrittenHistory = useAppStore((s) => s.applyRewrittenHistory);
  const rewriteDraftWithAgent = useAppStore((s) => s.rewriteDraftWithAgent);
  const pushHistoryRewrite = useAppStore((s) => s.pushHistoryRewrite);
  const restoreHistory = useAppStore((s) => s.restoreHistory);
  const bringOriginIntoHistory = useAppStore((s) => s.bringOriginIntoHistory);
  const dismissHistoryRun = useAppStore((s) => s.dismissHistoryRun);
  if (mountId === null) {
    return null;
  }
  const attempt = ({ key, failureTitle, task }: PendingActionRun): void => {
    void history.run({ key, failureTitle, task });
  };
  return {
    refresh: () => void loadHistoryDraft({ sessionId, mountId }),
    dismiss: () => dismissHistoryRun({ sessionId, mountId }),
    rewriteWithAgent: () =>
      attempt({
        key: 'rewrite',
        failureTitle: "Couldn't start the history rewriter",
        task: () => rewriteDraftWithAgent({ sessionId, mountId }),
      }),
    applyRewritten: (shouldPush: boolean) =>
      attempt({
        key: 'apply',
        failureTitle: "Couldn't apply the rewritten history",
        task: () => applyRewrittenHistory({ sessionId, mountId, shouldPush }),
      }),
    restoreBackup: (backup: HistoryBackup) =>
      attempt({
        key: 'restore',
        failureTitle: "Couldn't restore the backup",
        task: () =>
          restoreHistory({
            sessionId,
            mountId,
            backupRef: backup.refName,
            shouldPush: hasUpstream,
          }),
      }),
    discard: () =>
      attempt({
        key: 'discard',
        failureTitle: "Couldn't discard the plan",
        task: () => discardHistoryDraft({ sessionId, mountId }),
      }),
    apply: (shouldPush: boolean) =>
      attempt({
        key: 'apply',
        failureTitle: "Couldn't apply the new history",
        task: () => applyHistoryDraft({ sessionId, mountId, shouldPush }),
      }),
    push: (run: HistoryRun) =>
      attempt({
        key: 'push',
        failureTitle: "Couldn't push the rewritten history",
        task: () =>
          pushHistoryRewrite({
            sessionId,
            mountId,
            origin: run.origin,
            planId: run.planId,
            expectedRemoteSha: run.remoteSha,
            identity: run.identity,
          }).then(() => loadHistoryDraft({ sessionId, mountId })),
      }),
    bringOrigin: () =>
      attempt({
        key: 'bring-origin',
        failureTitle: "Couldn't bring origin into the history",
        task: () => bringOriginIntoHistory({ sessionId, mountId }),
      }),
    restoreApplied: (run: HistoryRun) => {
      const backupRef = run.backupRef;
      if (backupRef === null) {
        return;
      }
      attempt({
        key: 'restore',
        failureTitle: "Couldn't undo the rewrite",
        task: () =>
          restoreHistory({
            sessionId,
            mountId,
            backupRef,
            shouldPush: run.phase === 'pushed' && hasUpstream,
          }),
      });
    },
  };
};

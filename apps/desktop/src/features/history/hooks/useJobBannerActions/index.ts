import { useCallback, useRef, useState } from 'react';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { useShallow } from 'zustand/react/shallow';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { captureStartHint } from '../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { rebasePlanArgs } from '../../../../store/slices/history/rebaseBranch';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../../store/slices/project-mounts/selectors';
import { usePendingAction, type PendingActionRun } from '../../../../shared/hooks/usePendingAction';
import { ReportedError } from '../../../../store/slices/notifications/reportedError';
import { refreshWorktreeStatuses } from '../../../../store/slices/worktreeStatuses/cache';
import { worktreeAbortRebase, worktreeContinueRebase } from '../../../worktree/worktree';
import { discardHistoryCopy, readRebasePlan } from '../../historyEngine';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly agentId: AgentId | null;
};

type RetryWithNoteParams = {
  readonly note: string;
};

export type JobBannerFailure = {
  readonly key: string;
  readonly message: string;
};

export const useJobBannerActions = ({ sessionId, worktreePath, agentId }: Params) => {
  const mount = useAppStore(
    useShallow((s) => selectMountForPath({ state: s, sessionId, path: worktreePath })),
  );
  const chosenBase = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const copyText = useCopyText();
  const run = useAppStore((s) =>
    mount?.mountId === undefined ? undefined : s.historyRuns[mount.mountId],
  );
  const pending = usePendingAction({ sessionId });
  const mountId = mount?.mountId ?? null;
  const [failure, setFailure] = useState<JobBannerFailure | null>(null);
  const failedRun = useRef<PendingActionRun | null>(null);
  const attempt = (params: Parameters<typeof pending.run>[0]): void => {
    void pending.run(params);
  };
  const runInline = useCallback(
    (params: PendingActionRun): void => {
      setFailure(null);
      failedRun.current = null;
      void pending.run({
        ...params,
        task: async () => {
          try {
            await params.task();
          } catch (error) {
            const message = formatError(error);
            failedRun.current = params;
            setFailure({ key: params.key, message });
            throw new ReportedError(message);
          }
        },
      });
    },
    [pending],
  );
  const refreshHere = async (): Promise<void> => {
    if (worktreePath !== null) {
      await refreshWorktreeStatuses({ worktreePaths: [worktreePath] });
    }
  };
  return {
    mountId,
    pendingKeys: pending.pendingKeys,
    failure,
    retryFailed: () => {
      const params = failedRun.current;
      if (params !== null) {
        runInline(params);
      }
    },
    resolveWithAuto: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'resolve-auto',
        failureTitle: "Couldn't start Auto.",
        task: async () => {
          const state = useAppStore.getState();
          const capture = captureStartHint({
            state,
            sessionId,
            scope: START_HINT_SCOPES.rebase({ mountId }),
          });
          await state.resolveRebaseWithAuto({
            sessionId,
            mountIds: [mountId],
            hint: capture.text,
            onAccepted: () => useAppStore.getState().settleStartHint({ capture }),
          });
        },
      });
    },
    resolveMyself: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'resolve-myself',
        failureTitle: "Couldn't start the rebase in the worktree.",
        task: () => useAppStore.getState().resolveRebaseMyself({ sessionId, mountId }),
      });
    },
    keep: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'keep',
        failureTitle: "Couldn't keep the branch as it was.",
        task: () => useAppStore.getState().keepRebaseStop({ sessionId, mountId }),
      });
    },
    continueRebase: () => {
      if (worktreePath === null) {
        return;
      }
      runInline({
        key: 'continue',
        failureTitle: "Couldn't continue the rebase.",
        task: async () => {
          await worktreeContinueRebase({ worktreePath });
          await refreshHere();
        },
      });
    },
    abortHere: () => {
      if (worktreePath === null) {
        return;
      }
      runInline({
        key: 'abort-here',
        failureTitle: "Couldn't abort the rebase.",
        task: async () => {
          await worktreeAbortRebase({ worktreePath });
          await refreshHere();
        },
      });
    },
    bringIn: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'bring-in',
        failureTitle: "Couldn't bring the online commits in.",
        task: () => useAppStore.getState().bringOriginInAndPush({ sessionId, mountId }),
      });
    },
    undoRebase: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'undo-rebase',
        failureTitle: "Couldn't undo the rebase.",
        task: async () => {
          const state = useAppStore.getState();
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
      });
    },
    stashAndMove: () => {
      if (mountId === null) {
        return;
      }
      attempt({
        key: 'stash-move',
        failureTitle: "Couldn't set your files aside safely.",
        task: () => useAppStore.getState().resumeHistoryMove({ sessionId, mountId }),
      });
    },
    bringBack: () => {
      if (mountId === null) {
        return;
      }
      attempt({
        key: 'bring-back',
        failureTitle: "Couldn't bring your files back.",
        task: () => useAppStore.getState().bringBackHistoryFiles({ sessionId, mountId }),
      });
    },
    forgetSaved: () => {
      if (mountId === null) {
        return;
      }
      attempt({
        key: 'forget-saved',
        failureTitle: "Couldn't clear the saved files.",
        task: () => useAppStore.getState().forgetHistoryFiles({ sessionId, mountId }),
      });
    },
    copyStashCommand: () => {
      if (run?.savedStash === undefined) {
        return;
      }
      void copyText({ text: `git stash apply ${run.savedStash.sha}` });
    },
    retryRebase: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'retry-rebase',
        failureTitle: "Couldn't retry the rebase.",
        task: () => useAppStore.getState().rebaseBranch({ sessionId, mountId }),
      });
    },
    fixPush: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'fix-push',
        failureTitle: "Couldn't start the agent.",
        task: () => {
          const state = useAppStore.getState();
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
      });
    },
    retryPush: () => {
      if (mountId === null) {
        return;
      }
      runInline({
        key: 'retry-push',
        failureTitle: "Couldn't retry the push.",
        task: async () => {
          const state = useAppStore.getState();
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
    },
    retryWithNote: ({ note }: RetryWithNoteParams) => {
      if (mountId === null || worktreePath === null) {
        return;
      }
      attempt({
        key: 'retry-note',
        failureTitle: "Couldn't retry with your note.",
        task: async () => {
          const binding =
            agentId === null ? undefined : useAppStore.getState().historyRewriters[agentId];
          const plan =
            binding !== undefined
              ? binding.plan
              : rebasePlanArgs({
                  worktreePath,
                  rebase: await readRebasePlan({
                    worktreePath,
                    baseBranch: chosenBase,
                    fetches: false,
                  }),
                });
          if (agentId !== null && binding !== undefined) {
            useAppStore.setState((state) => {
              const { [agentId]: _dropped, ...rest } = state.historyRewriters;
              return { historyRewriters: rest };
            });
            await discardHistoryCopy({ worktreePath, copyPath: binding.copyPath }).catch(
              (error: unknown) =>
                useAppStore
                  .getState()
                  .reportError({ title: "Couldn't clean up the old copy.", error, sessionId }),
            );
          }
          await useAppStore.getState().startHistoryRewriter({
            sessionId,
            mountId,
            plan,
            origin: 'rebase',
            planId: null,
            note,
          });
        },
      });
    },
  };
};

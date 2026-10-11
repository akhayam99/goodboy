import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { rebasePlanArgs } from '../../../../store/slices/history/rebaseBranch';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../../store/slices/project-mounts/selectors';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { discardHistoryCopy, readRebasePlan } from '../../historyEngine';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly agentId: AgentId | null;
};

type RetryWithNoteParams = {
  readonly note: string;
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
  const attempt = (params: Parameters<typeof pending.run>[0]): void => {
    void pending.run(params);
  };
  return {
    pendingKeys: pending.pendingKeys,
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
      attempt({
        key: 'retry-rebase',
        failureTitle: "Couldn't retry the rebase.",
        task: () => useAppStore.getState().rebaseBranch({ sessionId, mountId }),
      });
    },
    bringOrigin: () => {
      if (mountId === null) {
        return;
      }
      attempt({
        key: 'bring-origin',
        failureTitle: "Couldn't bring the online commits into the plan.",
        task: () => useAppStore.getState().bringOriginIntoHistory({ sessionId, mountId }),
      });
    },
    retryPush: () => {
      if (mountId === null) {
        return;
      }
      attempt({
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

import { useCallback, useMemo, useRef, useState } from 'react';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { useShallow } from 'zustand/react/shallow';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { rebaseStopVerbs } from '../../../../store/slices/history/rebaseStopVerbs';
import { rebasePlanArgs } from '../../../../store/slices/history/rebaseBranch';
import {
  selectMountBaseBranch,
  selectMountForPath,
  selectWritableMounts,
} from '../../../../store/slices/project-mounts/selectors';
import { usePendingAction, type PendingActionRun } from '../../../../shared/hooks/usePendingAction';
import { ReportedError } from '../../../../store/slices/notifications/reportedError';
import { refreshWorktreeStatuses } from '../../../../store/runtime/worktreeStatuses/cache';
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
  readonly mountName: string;
};

const NO_FAILURES: Readonly<Record<string, JobBannerFailure>> = {};

const NO_MOUNT = 'none';

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
  const mountName = mount?.mountName ?? '';
  const verbs = useMemo(
    () =>
      mountId === null ? null : rebaseStopVerbs({ get: useAppStore.getState, sessionId, mountId }),
    [mountId, sessionId],
  );
  const owner = mountId ?? NO_MOUNT;
  const scope = `${owner}:`;
  const [failures, setFailures] = useState<Readonly<Record<string, JobBannerFailure>>>(NO_FAILURES);
  const failedRuns = useRef(new Map<string, PendingActionRun>());
  const failure = failures[owner] ?? null;
  const hasManyMounts = useAppStore(
    (s) => selectWritableMounts({ state: s, sessionId }).length > 1,
  );
  const failureLine =
    failure === null
      ? null
      : hasManyMounts
        ? `${failure.mountName}: ${failure.message}`
        : failure.message;
  const pendingKeys = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        Array.from(pending.pendingKeys)
          .filter((key) => key.startsWith(scope))
          .map((key) => key.slice(scope.length)),
      ),
    [pending.pendingKeys, scope],
  );
  const attempt = (params: PendingActionRun): void => {
    void pending.run({ ...params, key: `${scope}${params.key}` });
  };
  const runInline = useCallback(
    (params: PendingActionRun): void => {
      setFailures((current) => {
        const { [owner]: _cleared, ...rest } = current;
        return rest;
      });
      failedRuns.current.delete(owner);
      void pending.run({
        ...params,
        key: `${scope}${params.key}`,
        task: async () => {
          try {
            await params.task();
          } catch (error) {
            const message = formatError(error);
            failedRuns.current.set(owner, params);
            setFailures((current) => ({
              ...current,
              [owner]: { key: params.key, message, mountName },
            }));
            throw new ReportedError(message);
          }
        },
      });
    },
    [mountName, owner, pending, scope],
  );
  const refreshHere = async (): Promise<void> => {
    if (worktreePath !== null) {
      await refreshWorktreeStatuses({ worktreePaths: [worktreePath] });
    }
  };
  return {
    mountId,
    pendingKeys,
    failure,
    failureLine,
    retryFailed: () => {
      const params = failedRuns.current.get(owner);
      if (params !== undefined) {
        runInline(params);
      }
    },
    resolveWithAuto: () => {
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'resolve-auto',
        failureTitle: "Couldn't start Auto.",
        task: verbs.resolveWithAuto,
      });
    },
    resolveMyself: () => {
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'resolve-myself',
        failureTitle: "Couldn't start the rebase in the worktree.",
        task: verbs.resolveMyself,
      });
    },
    keep: () => {
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'keep',
        failureTitle: "Couldn't keep the branch as it was.",
        task: verbs.keep,
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
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'bring-in',
        failureTitle: "Couldn't bring the online commits in.",
        task: verbs.bringIn,
      });
    },
    undoRebase: () => {
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'undo-rebase',
        failureTitle: "Couldn't undo the rebase.",
        task: verbs.undoRebase,
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
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'retry-rebase',
        failureTitle: "Couldn't retry the rebase.",
        task: verbs.retryRebase,
      });
    },
    fixPush: () => {
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'fix-push',
        failureTitle: "Couldn't start the agent.",
        task: verbs.fixPush,
      });
    },
    retryPush: () => {
      if (verbs === null) {
        return;
      }
      runInline({
        key: 'retry-push',
        failureTitle: "Couldn't retry the push.",
        task: verbs.retryPush,
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

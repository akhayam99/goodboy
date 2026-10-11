import { parseUnifiedDiff } from '@goodboy/core';
import type { FileDiff, MountId, SessionId } from '@goodboy/types';
import { useEffect, useRef, useState } from 'react';
import { useNow } from '../../../../shared/hooks/useNow';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useAppStore } from '../../../../store';
import type { HistoryRun } from '../../../../store/slices/history/types';
import { readHistoryCopyGitDirs } from '../../historyEngine';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

type Expansion = {
  readonly run: HistoryRun;
  readonly files: ReadonlyArray<FileDiff>;
};

export const useHistoryChangeReview = ({ sessionId, mountId }: Params) => {
  const run = useAppStore((state) => (mountId === null ? undefined : state.historyRuns[mountId]));
  const activeRun = useRef<HistoryRun | undefined>(run);
  const [missingRun, setMissingRun] = useState<HistoryRun | null>(null);
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const pending = usePendingAction({ sessionId });
  const review = run?.stop?.review;
  const now = useNow();
  const isEligible =
    run !== undefined &&
    run.sessionId === sessionId &&
    run.phase === 'stopped' &&
    run.stop?.reason === 'invalid' &&
    run.stop.files.length > 0 &&
    run.copyPath !== null &&
    review !== undefined &&
    review !== null &&
    review.keptUntil * 1_000 > now;

  useEffect(() => {
    activeRun.current = run;
    return () => {
      activeRun.current = undefined;
    };
  }, [run]);

  const canReview = isEligible && missingRun !== run;
  const isExpanded = canReview && expansion?.run === run;
  const isPending = pending.pendingKeys.size > 0;
  return {
    copyPath: run?.copyPath ?? null,
    canReview,
    isExpanded,
    isPending,
    files: isExpanded ? expansion.files : [],
    open: () => {
      if (
        !canReview ||
        run === undefined ||
        run.copyPath === null ||
        review === null ||
        review === undefined ||
        mountId === null
      ) {
        return;
      }
      void pending.run({
        key: 'review',
        failureTitle: "Couldn't review the change.",
        task: async () => {
          const copyPath = run.copyPath;
          if (copyPath === null) {
            return;
          }
          const dirs = await readHistoryCopyGitDirs({ copyPath });
          if (useAppStore.getState().historyRuns[mountId] !== run || activeRun.current !== run) {
            return;
          }
          if (dirs === null) {
            setMissingRun(run);
            throw new Error('The kept copy expired or was removed.');
          }
          const files = parseUnifiedDiff(review.diff).filter(
            (file) => run.stop?.files.includes(file.path) === true,
          );
          if (files.length !== run.stop?.files.length) {
            throw new Error('The kept change could not be read completely.');
          }
          setExpansion({ run, files });
        },
      });
    },
    accept: () => {
      if (mountId === null || !isExpanded) {
        return;
      }
      void pending.run({
        key: 'review',
        failureTitle: "Couldn't apply the reviewed change.",
        task: () => useAppStore.getState().acceptHistoryChange({ sessionId, mountId }),
      });
    },
    discard: () => {
      if (mountId === null || !isExpanded) {
        return;
      }
      void pending.run({
        key: 'review',
        failureTitle: "Couldn't discard the kept copy.",
        task: () => useAppStore.getState().discardHistoryChange({ sessionId, mountId }),
      });
    },
  };
};

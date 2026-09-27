import { useEffect, useState } from 'react';
import { predictHistoryPlan, readRebasePlan } from '../historyEngine';
import { rebasePlanArgs } from '../../../store/slices/history/rebaseBranch';

type Params = {
  readonly worktreePath: string | null;
  readonly baseBranch: string;
  readonly head: string | null;
  readonly isEnabled: boolean;
};

export type RebasePrediction = {
  readonly conflictFiles: ReadonlyArray<string>;
  readonly isClean: boolean;
};

export const useRebasePrediction = ({
  worktreePath,
  baseBranch,
  head,
  isEnabled,
}: Params): RebasePrediction | null => {
  const [prediction, setPrediction] = useState<RebasePrediction | null>(null);

  useEffect(() => {
    if (!isEnabled || worktreePath === null || head === null) {
      setPrediction(null);
      return;
    }
    let isCurrent = true;
    const run = async () => {
      const rebase = await readRebasePlan({ worktreePath, baseBranch, fetches: false });
      const predicted = await predictHistoryPlan(rebasePlanArgs({ worktreePath, rebase }));
      if (!isCurrent || !predicted.isSupported) {
        return;
      }
      const conflict = predicted.steps.find((step) => step.outcome === 'conflict') ?? null;
      setPrediction({
        conflictFiles: conflict === null ? [] : conflict.files,
        isClean: predicted.head !== null,
      });
    };
    void run().catch(() => {
      if (isCurrent) {
        setPrediction(null);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [baseBranch, head, isEnabled, worktreePath]);

  return prediction;
};

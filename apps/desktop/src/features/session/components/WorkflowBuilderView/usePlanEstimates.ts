import { useEffect, useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { planEstimates, type PlanEstimates, type PlanStepInput } from './planEstimates';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly steps: ReadonlyArray<PlanStepInput>;
  readonly isOrchestrated: boolean;
  readonly isReviewed: boolean;
};

export const usePlanEstimates = ({
  workspaceId,
  steps,
  isOrchestrated,
  isReviewed,
}: Params): PlanEstimates | null => {
  const history = useAppStore((state) => state.workspaceDurationHistory?.[workspaceId]);
  const loadWorkspaceDurationHistory = useAppStore((state) => state.loadWorkspaceDurationHistory);
  const isLoaded = history !== undefined;

  useEffect(() => {
    if (!isLoaded) {
      void loadWorkspaceDurationHistory?.({ workspaceId });
    }
  }, [isLoaded, loadWorkspaceDurationHistory, workspaceId]);

  const signature = steps
    .map((step) =>
      [step.key, step.role, step.provider, step.model, step.effort, step.size].join('|'),
    )
    .join(',');
  const stepsRef = useMemo(() => steps, [signature]);

  return useMemo(
    () =>
      planEstimates({
        history: history ?? null,
        steps: stepsRef,
        isOrchestrated,
        isReviewed,
        nowMs: Date.now(),
      }),
    [history, isOrchestrated, isReviewed, stepsRef],
  );
};

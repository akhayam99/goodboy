import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useShowToast } from '../../../shared/components/Toast/useShowToast';
import type { RunPlanResult } from '../../../store/slices/plans/types';
import { planRunToast } from '../planRunToast';

type Params = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
};

export type PlanRun = {
  readonly run: () => Promise<void>;
  readonly isSpawning: boolean;
  readonly error: string | null;
};

type AnnounceParams = {
  readonly result: RunPlanResult;
  readonly sessionId: SessionId;
};

export const usePlanRunToast = (): ((params: AnnounceParams) => void) => {
  const navigate = useAppStore((s) => s.navigate);
  const showToast = useShowToast();
  return useCallback(
    ({ result, sessionId }) => {
      const toast = planRunToast({ result, sessionId, navigate });
      if (toast !== null) {
        showToast(toast);
      }
    },
    [navigate, showToast],
  );
};

export const usePlanRun = ({ sessionId, planId }: Params): PlanRun => {
  const runPlan = useAppStore((s) => s.runPlan);
  const announce = usePlanRunToast();
  const [isSpawning, setIsSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (isSpawning) {
      return;
    }
    setIsSpawning(true);
    setError(null);
    try {
      announce({ result: await runPlan(sessionId, planId), sessionId });
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSpawning(false);
    }
  }, [announce, isSpawning, planId, runPlan, sessionId]);

  return { run, isSpawning, error };
};

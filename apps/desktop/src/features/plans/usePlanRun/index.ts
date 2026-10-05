import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAgentStartedToast } from '../../../shared/hooks/useAgentStartedToast';

type Params = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
};

export type PlanRun = {
  readonly run: () => Promise<void>;
  readonly isSpawning: boolean;
  readonly error: string | null;
};

export const usePlanRun = ({ sessionId, planId }: Params): PlanRun => {
  const runPlan = useAppStore((s) => s.runPlan);
  const announceAgentStarted = useAgentStartedToast();
  const [isSpawning, setIsSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (isSpawning) {
      return;
    }
    setIsSpawning(true);
    setError(null);
    try {
      const agentId = await runPlan(sessionId, planId);
      announceAgentStarted({
        sessionId,
        agentId,
        title: 'Implementer started',
        message: 'An agent is running this plan. You can keep working.',
      });
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSpawning(false);
    }
  }, [announceAgentStarted, isSpawning, planId, runPlan, sessionId]);

  return { run, isSpawning, error };
};

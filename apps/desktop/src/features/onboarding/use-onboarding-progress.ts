import { useEffect, useState, useMemo } from 'react';
import { useAppStore, useCurrentSession, useWorkspaces } from '../../store';
import {
  ONBOARDING_STEPS,
  getCompleted,
  isDismissed,
  markStepComplete,
  type OnboardingStepId,
} from './onboarding-store';

/**
 * Reads progress from localStorage and auto-detects new completions
 * from store events (workspace added, session created, agent spawned,
 * plan emitted). The 'skill' and 'palette' steps are nudged separately
 * — they fire on first user action in their respective UIs.
 */
export interface OnboardingProgress {
  readonly completedCount: number;
  readonly totalCount: number;
  readonly completed: ReadonlySet<OnboardingStepId>;
  readonly dismissed: boolean;
  readonly isDone: boolean;
}

export function useOnboardingProgress(): OnboardingProgress {
  const workspaces = useWorkspaces();
  const sessions = useAppStore((s) => s.sessions);
  const sessionPhaseRuns = useAppStore((s) => s.sessionPhaseRuns);
  const sessionPlans = useAppStore((s) => s.sessionPlans);
  const currentSession = useCurrentSession();

  // localStorage is the source of truth (monotonic). Re-read on a custom
  // event so manual markStepComplete calls in other components propagate.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener('goodboy:onboarding-progress', onChange);
    return () => window.removeEventListener('goodboy:onboarding-progress', onChange);
  }, []);

  const persistedCompleted = useMemo(() => new Set(getCompleted()), [tick]);
  const dismissed = useMemo(() => isDismissed(), [tick]);

  // Auto-detect completions from store state. These mark the persisted
  // store so the chip stays consistent after reload.
  useEffect(() => {
    if (workspaces.length > 0 && !persistedCompleted.has('workspace')) {
      markStepComplete('workspace');
    }
    if (sessions.length > 0 && !persistedCompleted.has('session')) {
      markStepComplete('session');
    }
    const anyAgent = Object.values(sessionPhaseRuns).some((runs) => runs.length > 0);
    if (anyAgent && !persistedCompleted.has('agent')) {
      markStepComplete('agent');
    }
    const anyPlan = Object.values(sessionPlans).some((p) => p.length > 0);
    if (anyPlan && !persistedCompleted.has('plan')) {
      markStepComplete('plan');
    }
  }, [
    workspaces.length,
    sessions.length,
    sessionPhaseRuns,
    sessionPlans,
    persistedCompleted,
    currentSession,
  ]);

  const totalCount = ONBOARDING_STEPS.length;
  const completedCount = persistedCompleted.size;

  return {
    completedCount,
    totalCount,
    completed: persistedCompleted,
    dismissed,
    isDone: completedCount >= totalCount,
  };
}

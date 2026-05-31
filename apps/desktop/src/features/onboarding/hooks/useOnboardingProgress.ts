import { useEffect, useState, useMemo } from 'react';
import { useAppStore, useCurrentSession, useWorkspaces } from '../../../../store';
import {
  ONBOARDING_STEPS,
  getCompleted,
  isCollapsed,
  isFinished,
  markStepComplete,
  type OnboardingStepId,
} from '../../onboarding-store';

/**
 * Reads progress from localStorage and auto-detects new completions
 * from store events (workspace added, session created, agent spawned,
 * plan emitted). The 'skill' and 'palette' steps are nudged separately
 *, they fire on first user action in their respective UIs.
 */
export interface OnboardingProgress {
  readonly completedCount: number;
  readonly totalCount: number;
  readonly completed: ReadonlySet<OnboardingStepId>;
  /** Card collapsed to the chip, reopenable, not a permanent dismiss. */
  readonly collapsed: boolean;
  /** Wrap-up acknowledged, onboarding gone for good. */
  readonly finished: boolean;
  readonly isDone: boolean;
}

export function useOnboardingProgress(): OnboardingProgress {
  // localStorage is the source of truth (monotonic). Re-read on a custom
  // event so manual markStepComplete calls in other components propagate.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener('goodboy:onboarding-progress', onChange);
    return () => window.removeEventListener('goodboy:onboarding-progress', onChange);
  }, []);

  const persistedCompleted = useMemo(() => new Set(getCompleted()), [tick]);
  const collapsed = useMemo(() => isCollapsed(), [tick]);
  const finished = useMemo(() => isFinished(), [tick]);

  // Subscribe to *derived booleans*, not the raw maps. Subscribing to
  // sessionPhaseRuns or sessionPlans would re-render every consumer of
  // this hook (the floating card + the sidebar chip) on every agent or
  // plan update across the entire app. We only need "did anything pass
  // the gate yet", and once the corresponding step is persisted, we
  // collapse the selector to a constant `false` so updates are ignored.
  const workspaces = useWorkspaces();
  const sessionCount = useAppStore((s) => s.sessions.length);
  const needsAgentDetect = !persistedCompleted.has('agent');
  const needsPlanDetect = !persistedCompleted.has('plan');
  const anyAgent = useAppStore((s) => {
    if (!needsAgentDetect) return false;
    for (const runs of Object.values(s.sessionPhaseRuns)) {
      if (runs.length > 0) return true;
    }
    return false;
  });
  const anyPlan = useAppStore((s) => {
    if (!needsPlanDetect) return false;
    for (const plans of Object.values(s.sessionPlans)) {
      if (plans.length > 0) return true;
    }
    return false;
  });
  const currentSession = useCurrentSession();

  // Auto-detect completions from store state. These mark the persisted
  // store so the chip stays consistent after reload.
  useEffect(() => {
    if (workspaces.length > 0 && !persistedCompleted.has('workspace')) {
      markStepComplete('workspace');
    }
    if (sessionCount > 0 && !persistedCompleted.has('session')) {
      markStepComplete('session');
    }
    if (anyAgent && !persistedCompleted.has('agent')) {
      markStepComplete('agent');
    }
    if (anyPlan && !persistedCompleted.has('plan')) {
      markStepComplete('plan');
    }
  }, [workspaces.length, sessionCount, anyAgent, anyPlan, persistedCompleted, currentSession]);

  const totalCount = ONBOARDING_STEPS.length;
  const completedCount = persistedCompleted.size;

  return {
    completedCount,
    totalCount,
    completed: persistedCompleted,
    collapsed,
    finished,
    isDone: completedCount >= totalCount,
  };
}

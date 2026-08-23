import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAppStore, useCurrentSession, useWorkspaces } from '../../../../store';
import { ghStatus } from '../../../github/github';
import {
  visibleOnboardingSteps,
  getCompleted,
  isCollapsed,
  isFinished,
  markStepComplete,
  type OnboardingStepId,
} from '../../onboarding-store';

export type OnboardingProgress = {
  readonly completedCount: number;
  readonly totalCount: number;
  readonly completed: ReadonlySet<OnboardingStepId>;
  readonly collapsed: boolean;
  readonly finished: boolean;
  readonly isDone: boolean;
  readonly isSimple: boolean;
  readonly hasProjects: boolean;
};

export const useOnboardingProgress = (): OnboardingProgress => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener('goodboy:onboarding-progress', onChange);
    return () => window.removeEventListener('goodboy:onboarding-progress', onChange);
  }, []);

  const persistedCompleted = useMemo(() => new Set(getCompleted()), [tick]);
  const collapsed = useMemo(() => isCollapsed(), [tick]);
  const finished = useMemo(() => isFinished(), [tick]);

  const workspaces = useWorkspaces();
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const workspace =
    workspaces.find((candidate) => candidate.id === currentWorkspaceId) ?? workspaces[0] ?? null;
  const isSimple = false;
  const sessionCount = useAppStore((s) => s.sessions.length);
  const needsAgentDetect = !persistedCompleted.has('agent');
  const needsPlanDetect = !persistedCompleted.has('plan');
  const anyAgent = useAppStore((s) => {
    if (!needsAgentDetect) {
      return false;
    }
    for (const runs of Object.values(s.sessionPhaseRuns)) {
      if (runs.length > 0) {
        return true;
      }
    }
    return false;
  });
  const anyPlan = useAppStore((s) => {
    if (!needsPlanDetect) {
      return false;
    }
    for (const plans of Object.values(s.sessionPlans)) {
      if (plans.length > 0) {
        return true;
      }
    }
    return false;
  });
  const currentSession = useCurrentSession();

  const workspaceId = workspace?.id ?? null;
  const hasProjects = useAppStore((s) =>
    workspaceId ? s.projects.some((project) => project.workspaceId === workspaceId) : false,
  );
  const needsCodeHostDetect = !isSimple && !persistedCompleted.has('codeHost');
  const gitlabConnected = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'gitlab')
      : false,
  );
  const bitbucketConnected = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'bitbucket')
      : false,
  );
  const hasTools = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some(
          (i) =>
            i.provider === 'linear' ||
            i.provider === 'jira' ||
            i.provider === 'sentry' ||
            i.provider === 'slack',
        )
      : false,
  );

  const [githubScoped, setGithubScoped] = useState(false);
  const refreshGithubStatus = useCallback(() => {
    if (!workspaceId || !needsCodeHostDetect) {
      return;
    }
    void ghStatus(workspaceId)
      .then((status) => setGithubScoped(status.scoped ?? false))
      .catch(() => setGithubScoped(false));
  }, [workspaceId, needsCodeHostDetect]);
  useEffect(() => {
    refreshGithubStatus();
  }, [refreshGithubStatus]);

  useEffect(() => {
    if (workspaces.length > 0 && !persistedCompleted.has('workspace')) {
      markStepComplete('workspace');
    }
    if (
      !isSimple &&
      (gitlabConnected || bitbucketConnected || githubScoped) &&
      !persistedCompleted.has('codeHost')
    ) {
      markStepComplete('codeHost');
    }
    if (hasTools && !persistedCompleted.has('tools')) {
      markStepComplete('tools');
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
  }, [
    workspaces.length,
    sessionCount,
    anyAgent,
    anyPlan,
    gitlabConnected,
    bitbucketConnected,
    githubScoped,
    hasTools,
    isSimple,
    persistedCompleted,
    currentSession,
  ]);

  const completed = useMemo(() => {
    const liveCompleted = new Set(persistedCompleted);
    if (workspaces.length > 0) {
      liveCompleted.add('workspace');
    }
    if (!isSimple && (gitlabConnected || bitbucketConnected || githubScoped)) {
      liveCompleted.add('codeHost');
    }
    if (hasTools) {
      liveCompleted.add('tools');
    }
    if (sessionCount > 0) {
      liveCompleted.add('session');
    }
    if (anyAgent) {
      liveCompleted.add('agent');
    }
    if (anyPlan) {
      liveCompleted.add('plan');
    }
    return liveCompleted;
  }, [
    persistedCompleted,
    workspaces.length,
    isSimple,
    gitlabConnected,
    bitbucketConnected,
    githubScoped,
    hasTools,
    sessionCount,
    anyAgent,
    anyPlan,
  ]);
  const visibleSteps = visibleOnboardingSteps({ isSimple });
  const totalCount = visibleSteps.length;
  const completedCount = visibleSteps.filter((step) => completed.has(step.id)).length;

  return {
    completedCount,
    totalCount,
    completed,
    collapsed,
    finished,
    isDone: completedCount >= totalCount,
    isSimple,
    hasProjects,
  };
};

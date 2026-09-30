import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { ghStatus } from '../../../integrations/github/github';
import { normalizeWorkspaceProfile } from '../../../../shared/utils/normalizeWorkspaceProfile';
import {
  ONBOARDING_STEPS,
  getCompleted,
  isCollapsed,
  isFinished,
  isWizardDone,
  markStepComplete,
  type OnboardingStepId,
} from '../../onboarding-store';

export type OnboardingProgress = {
  readonly completedCount: number;
  readonly totalCount: number;
  readonly completed: ReadonlySet<OnboardingStepId>;
  readonly collapsed: boolean;
  readonly finished: boolean;
  readonly wizardDone: boolean;
  readonly isDone: boolean;
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
  const wizardDone = useMemo(() => isWizardDone(), [tick]);

  const workspaces = useWorkspaces();
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const workspace =
    workspaces.find((candidate) => candidate.id === currentWorkspaceId) ?? workspaces[0] ?? null;
  const workspaceId = workspace?.id ?? null;

  const hasProvider = useAppStore((s) => s.providers.some((p) => p.connection === 'connected'));
  const hasProjects = useAppStore((s) =>
    workspaceId ? s.projects.some((project) => project.workspaceId === workspaceId) : false,
  );
  const needsFirstSessionDetect = !persistedCompleted.has('firstSession');
  const anyAgentFinished = useAppStore((s) => {
    if (!needsFirstSessionDetect) {
      return false;
    }
    for (const runs of Object.values(s.sessionPhaseRuns)) {
      if (runs.some((agent) => agent.status === 'completed')) {
        return true;
      }
    }
    return Object.values(s.agentTurnState).some(
      (turn) => turn.kind === 'idle' || turn.kind === 'ended',
    );
  });
  const profile = normalizeWorkspaceProfile({ profile: workspace?.profile });
  const hasProfile =
    profile.roles.length > 0 ||
    profile.explainMore.length > 0 ||
    profile.aboutWork !== null ||
    profile.workingRules !== null;

  const needsCodeHostDetect = !persistedCompleted.has('codeHost');
  const integrationProviders = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).map((i) => i.provider).join(',')
      : '',
  );
  const globalGithubConnected = useAppStore(
    (s) => s.githubStatus !== null && s.githubStatus.mode !== 'absent',
  );
  const connectedIntegrations = useMemo(
    () => new Set(integrationProviders.split(',').filter((entry) => entry.length > 0)),
    [integrationProviders],
  );
  const hostIntegration =
    connectedIntegrations.has('gitlab') || connectedIntegrations.has('bitbucket');
  const hasTaskManager = connectedIntegrations.has('linear') || connectedIntegrations.has('jira');

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

  const live = useMemo(() => {
    const entries: ReadonlyArray<readonly [OnboardingStepId, boolean]> = [
      ['provider', hasProvider],
      ['project', hasProjects],
      ['codeHost', hostIntegration || githubScoped || globalGithubConnected],
      ['taskManager', hasTaskManager],
      ['firstSession', anyAgentFinished],
      ['profile', hasProfile],
    ];
    return entries.filter(([, isDone]) => isDone).map(([id]) => id);
  }, [
    hasProvider,
    hasProjects,
    hostIntegration,
    githubScoped,
    globalGithubConnected,
    hasTaskManager,
    anyAgentFinished,
    hasProfile,
  ]);

  useEffect(() => {
    for (const id of live) {
      if (!persistedCompleted.has(id)) {
        markStepComplete(id);
      }
    }
  }, [live, persistedCompleted]);

  const completed = useMemo(
    () => new Set<OnboardingStepId>([...persistedCompleted, ...live]),
    [persistedCompleted, live],
  );
  const totalCount = ONBOARDING_STEPS.length;
  const completedCount = ONBOARDING_STEPS.filter((step) => completed.has(step.id)).length;

  return {
    completedCount,
    totalCount,
    completed,
    collapsed,
    finished,
    wizardDone,
    isDone: completedCount >= totalCount,
    hasProjects,
  };
};

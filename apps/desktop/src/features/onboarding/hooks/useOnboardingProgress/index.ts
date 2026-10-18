import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { ghStatus } from '../../../integrations/github/github';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { normalizeWorkspaceProfile } from '../../../../shared/utils/normalizeWorkspaceProfile';
import { folderCountLabel } from '../../../workspace/folderCountLabel';
import {
  ONBOARDING_PROGRESS_EVENT,
  getCompleted,
  getWizardState,
  isCollapsed as readCollapsed,
  isFinished as readFinished,
  markStepComplete,
  type OnboardingStepId,
  type WizardState,
} from '../../onboarding-store';
import { setupProgress, type SetupItemId, type SetupProgress } from '../../setupProgress';

export type OnboardingProgress = {
  readonly setup: SetupProgress;
  readonly details: Readonly<Record<SetupItemId, string>>;
  readonly completed: ReadonlySet<OnboardingStepId>;
  readonly isCollapsed: boolean;
  readonly isFinished: boolean;
  readonly wizard: WizardState;
  readonly isWizardDone: boolean;
  readonly hasWorkspace: boolean;
  readonly hasProjects: boolean;
  readonly suggestsProfile: boolean;
};

export const useOnboardingProgress = (): OnboardingProgress => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onChange);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onChange);
  }, []);

  const persistedCompleted = useMemo(() => new Set(getCompleted()), [tick]);
  const collapsed = useMemo(() => readCollapsed(), [tick]);
  const finished = useMemo(() => readFinished(), [tick]);
  const wizard = useMemo(() => getWizardState(), [tick]);

  const workspaces = useWorkspaces();
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const workspace =
    workspaces.find((candidate) => candidate.id === currentWorkspaceId) ?? workspaces[0] ?? null;
  const workspaceId = workspace?.id ?? null;
  const readyProviderId = useAppStore(
    (s) => s.providers.find((p) => p.connection === 'connected')?.id ?? null,
  );
  const projectCount = useAppStore((s) =>
    workspaceId === null
      ? 0
      : s.projects.filter((project) => project.workspaceId === workspaceId).length,
  );
  const hasProjects = projectCount > 0;
  const foldersLabel = useAppStore((s) => folderCountLabel({ projects: s.projects, workspaceId }));

  const needsFirstSessionDetect = !persistedCompleted.has('first-session');
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

  const needsToolsDetect = !persistedCompleted.has('tools');
  const integrationProviders = useAppStore((s) =>
    workspaceId === null
      ? ''
      : (s.workspaceIntegrations[workspaceId] ?? []).map((i) => i.provider).join(','),
  );
  const globalGithubConnected = useAppStore(
    (s) => s.githubStatus !== null && s.githubStatus.mode !== 'absent',
  );
  const connectedIntegrations = useMemo(
    () => new Set(integrationProviders.split(',').filter((entry) => entry.length > 0)),
    [integrationProviders],
  );
  const hasHostIntegration =
    connectedIntegrations.has('gitlab') || connectedIntegrations.has('bitbucket');
  const hasTaskManager = connectedIntegrations.has('linear') || connectedIntegrations.has('jira');
  const [isGithubScoped, setIsGithubScoped] = useState(false);

  const refreshGithubStatus = useCallback(() => {
    if (workspaceId === null || !needsToolsDetect) {
      return;
    }
    void ghStatus(workspaceId)
      .then((status) => setIsGithubScoped(status.scoped ?? false))
      .catch(() => setIsGithubScoped(false));
  }, [workspaceId, needsToolsDetect]);

  useEffect(() => {
    refreshGithubStatus();
  }, [refreshGithubStatus]);

  const live = useMemo(() => {
    const entries: ReadonlyArray<readonly [OnboardingStepId, boolean]> = [
      ['agents', readyProviderId !== null],
      ['workspace', hasProjects],
      ['tools', hasHostIntegration || isGithubScoped || globalGithubConnected || hasTaskManager],
      ['first-session', anyAgentFinished],
      ['profile', hasProfile],
    ];
    return entries.filter(([, isDone]) => isDone).map(([id]) => id);
  }, [
    readyProviderId,
    hasProjects,
    hasHostIntegration,
    isGithubScoped,
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
  const setup = useMemo(() => setupProgress({ completed }), [completed]);
  const workspaceName = workspace?.name ?? null;

  const details = useMemo(
    (): Readonly<Record<SetupItemId, string>> => ({
      agents:
        readyProviderId === null
          ? 'Sign in to one agent'
          : `${PROVIDER_LABEL[readyProviderId]} is ready`,
      workspace:
        workspaceName === null || !hasProjects
          ? 'Pick a folder to work in'
          : `${workspaceName}, ${foldersLabel}`,
      tools: completed.has('tools') ? 'Code host or tasks connected' : 'Optional',
      'first-session': completed.has('first-session')
        ? 'Your first agent finished'
        : 'Ask Scout about the code',
    }),
    [readyProviderId, workspaceName, hasProjects, foldersLabel, completed],
  );

  return {
    setup,
    details,
    completed,
    isCollapsed: collapsed,
    isFinished: finished,
    wizard,
    isWizardDone: wizard === 'done',
    hasWorkspace: workspace !== null,
    hasProjects,
    suggestsProfile: completed.has('first-session') && !completed.has('profile'),
  };
};

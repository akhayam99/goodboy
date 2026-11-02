import type { StageInfoState } from './stageInfoOf';

const STAGE_INPUT_KEYS = [
  'sessions',
  'workspaces',
  'projects',
  'sessionBranches',
  'sessionWorktrees',
  'sessionProjectMounts',
  'sessionMounts',
  'sessionActiveMount',
  'sessionActiveProject',
  'mountGithub',
  'mountGitlabMr',
  'mountBitbucketPr',
  'prSeries',
  'sessionGithub',
  'sessionGitlabMr',
  'sessionOpenQuestions',
  'sessionPhaseRuns',
  'agentTurnState',
  'orchestratingWorkflowRuns',
  'selectedAgentId',
  'currentSessionId',
  'githubStatus',
  'hostReachability',
  'workspaceIntegrations',
  'sessionResolveThreads',
  'sessionResolveAttempts',
  'phaseTemplates',
  'sessionWorkflows',
  'agentKindOverride',
  'autoTreeViews',
  'sessionSlackDrafts',
  'sessionDismissedNextSteps',
  'sessionArtifacts',
] as const satisfies ReadonlyArray<keyof StageInfoState>;

type Params = {
  readonly state: StageInfoState;
};

export const stageInfoInputsOf = ({ state }: Params): Readonly<Record<string, unknown>> =>
  Object.fromEntries(STAGE_INPUT_KEYS.map((key) => [key, state[key]]));

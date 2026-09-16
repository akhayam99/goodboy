type Params = Record<string, never>;

export const createInitialSessionViewState = ({}: Params) => ({
  scriptsLensScope: null,
  sessionViewPrefs: {},
  activeLens: {},
  lensHistory: {},
  focusedPlanId: {},
  artifactFilter: {},
  artifactConversationAgentId: {},
  focusedGithubIssueNumber: {},
  focusedExternalTask: {},
  sessionStudio: {},
  workflowExpand: {},
  focusedWorkflowRunId: {},
  diffFocus: {},
  diffMountPath: {},
  terminalMountPath: {},
  resolveQueueView: {},
  resolveDiffReturn: {},
  resolveItemDrafts: {},
  sessionCreations: {},
});

type Params = Record<string, never>;

export const createInitialSessionViewState = ({}: Params) => ({
  scriptsLensScope: null,
  sessionViewPrefs: {},
  activeLens: {},
  focusedArtifactId: {},
  artifactFilter: {},
  artifactConversationAgentId: {},
  artifactCreation: {},
  focusedGithubIssueNumber: {},
  focusedExternalTask: {},
  sessionStudio: {},
  workflowExpand: {},
  focusedWorkflowRunId: {},
  diffFocus: {},
  diffMountPath: {},
  terminalMountPath: {},
  resolveQueueView: {},
  resolvePublicationRequest: {},
  resolveItemDrafts: {},
  sessionCreations: {},
});

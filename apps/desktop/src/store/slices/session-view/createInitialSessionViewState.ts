type Params = Record<string, never>;

export const createInitialSessionViewState = ({}: Params) => ({
  sessionViewPrefs: {},
  activeLens: {},
  lensHistory: {},
  focusedPlanId: {},
  focusedGithubIssueNumber: {},
  focusedExternalTask: {},
  sessionStudio: {},
  workflowExpand: {},
  focusedWorkflowRunId: {},
  diffFocus: {},
  diffMountPath: {},
  sessionCreations: {},
});

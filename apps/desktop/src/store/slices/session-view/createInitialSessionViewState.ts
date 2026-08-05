type Params = Record<string, never>;

export const createInitialSessionViewState = ({}: Params) => ({
  sessionViewPrefs: {},
  activeLens: {},
  lensHistory: {},
  focusedPlanId: {},
  focusedGithubIssueNumber: {},
  sessionStudio: {},
  workflowExpand: {},
  focusedWorkflowRunId: {},
  diffFocus: {},
  sessionCreations: {},
});

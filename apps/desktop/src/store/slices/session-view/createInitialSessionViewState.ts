type Params = Record<string, never>;

export const createInitialSessionViewState = ({}: Params) => ({
  sessionViewPrefs: {},
  activeLens: {},
  lensHistory: {},
  focusedPlanId: {},
  sessionStudio: {},
  workflowExpand: {},
  focusedWorkflowRunId: {},
  diffFocus: {},
  sessionCreations: {},
});

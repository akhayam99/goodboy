export const MAX_WORKFLOW_TITLE_LENGTH = 60;

export const clampWorkflowTitle = (value: string): string =>
  value.trim().slice(0, MAX_WORKFLOW_TITLE_LENGTH);

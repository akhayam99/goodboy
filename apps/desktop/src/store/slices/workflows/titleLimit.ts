export const MAX_WORKFLOW_TITLE_LENGTH = 60;

export const clampWorkflowTitle = (value: string): string => {
  const title = value.trim();
  if (title.length <= MAX_WORKFLOW_TITLE_LENGTH) {
    return title;
  }
  const lastSpace = title.lastIndexOf(' ', MAX_WORKFLOW_TITLE_LENGTH);
  return title.slice(0, lastSpace > 0 ? lastSpace : MAX_WORKFLOW_TITLE_LENGTH).trimEnd();
};

import type { OpenQuestion, WorkflowId, WorkflowRunId } from '@goodboy/types';

export const workflowHasOpenQuestions = (
  questions: ReadonlyArray<OpenQuestion>,
  workflowId: WorkflowId,
): boolean => {
  for (const q of questions) {
    if (q.status !== 'open') continue;
    if (!q.workflowId || q.workflowId === workflowId) return true;
  }
  return false;
};

export const workflowRunHasOpenQuestions = (
  questions: ReadonlyArray<OpenQuestion>,
  workflowRunId: WorkflowRunId,
): boolean => {
  for (const q of questions) {
    if (q.status !== 'open') continue;
    if (!q.workflowRunId || q.workflowRunId === workflowRunId) return true;
  }
  return false;
};

export const hasOrphanOpenQuestions = (questions: ReadonlyArray<OpenQuestion>): boolean => {
  return questions.some((q) => q.status === 'open' && !q.workflowId);
};

import type { OpenQuestion, WorkflowId } from '@goodboy/types';

// Returns true when the workflow has at least one open question blocking
// progress. Questions are blocking when:
//   - their workflowId matches the target (the question was raised by one
//     of this workflow's agents), or
//   - their workflowId is undefined (orphan, created before per-agent
//     provenance was stamped, or by an ad-hoc agent outside any workflow).
// Orphans block every workflow to preserve the legacy safe-default
// behaviour: when we don't know whose question it is, we don't assume
// it's safe to ignore.
export function workflowHasOpenQuestions(
  questions: ReadonlyArray<OpenQuestion>,
  workflowId: WorkflowId,
): boolean {
  for (const q of questions) {
    if (q.status !== 'open') continue;
    if (!q.workflowId || q.workflowId === workflowId) return true;
  }
  return false;
}

// True when the session has any orphan open question (no workflowId).
// Used at UI sites that don't have a specific workflow context (e.g. the
// ad-hoc "spawn agent" button) so they still gate on legacy questions.
export function hasOrphanOpenQuestions(questions: ReadonlyArray<OpenQuestion>): boolean {
  return questions.some((q) => q.status === 'open' && !q.workflowId);
}

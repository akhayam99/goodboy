import type { Step, Session, Workflow } from '@kay-am/types';

export function nextStep(template: Workflow, runs: ReadonlyArray<Session>): Step | null {
  const doneIds = new Set(
    runs.filter((r) => r.status === 'completed' || r.status === 'skipped').map((r) => r.stepId),
  );

  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return sorted.find((d) => !doneIds.has(d.id)) ?? null;
}

export function buildStepPrompt(input: {
  definition: Step;
  carryForwardContext: string;
  userMessage: string;
}): string {
  const parts = [input.definition.promptPrefix, input.carryForwardContext, input.userMessage]
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.join('\n\n');
}

export function isWorkflowComplete(template: Workflow, runs: ReadonlyArray<Session>): boolean {
  const doneIds = new Set(
    runs.filter((r) => r.status === 'completed' || r.status === 'skipped').map((r) => r.stepId),
  );
  return template.steps.every((d) => doneIds.has(d.id));
}

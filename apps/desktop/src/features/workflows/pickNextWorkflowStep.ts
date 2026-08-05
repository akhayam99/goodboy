import type { Agent, Step, Workflow } from '@goodboy/types';

type Gate = {
  readonly hasOpenQuestions?: boolean;
  readonly summarizerBusy?: boolean;
};

export const pickNextWorkflowStep = (
  workflow: Workflow,
  runs: ReadonlyArray<Agent>,
  gate?: Gate,
): Step | null => {
  if (gate?.hasOpenQuestions || gate?.summarizerBusy) {
    return null;
  }
  const sorted = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);
  for (const step of sorted) {
    const agent = runs.find((r) => r.stepId === step.id);
    if (!agent || agent.status !== 'pending') {
      continue;
    }
    const prevSteps = sorted.filter((s) => s.ordinal < step.ordinal);
    const allDone = prevSteps.every((s) =>
      runs.some((r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped')),
    );
    if (allDone) {
      return step;
    }
    return null;
  }
  return null;
};

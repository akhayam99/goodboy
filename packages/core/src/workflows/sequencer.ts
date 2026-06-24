import type { Step, Agent, Workflow, WorkflowRunId } from '@goodboy/types';

export const runsForWorkflowRun = (
  runs: ReadonlyArray<Agent>,
  workflowRunId: WorkflowRunId,
): ReadonlyArray<Agent> => {
  return runs.filter((r) => r.workflowRunId === workflowRunId);
};

export const nextStep = (template: Workflow, runs: ReadonlyArray<Agent>): Step | null => {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.stepId)
      .filter((id): id is Step['id'] => id !== undefined),
  );

  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return sorted.find((d) => !doneIds.has(d.id)) ?? null;
};

export const currentStep = (template: Workflow, runs: ReadonlyArray<Agent>): Step | null => {
  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  if (sorted.length === 0) {
    return null;
  }

  if (runs.length === 0) {
    return sorted[0] ?? null;
  }

  const stepById = new Map(sorted.map((s) => [s.id, s] as const));
  const isStartedAt = (r: Agent) => r.startedAt ?? '';

  const live = runs
    .filter((r) => r.status === 'running' || r.status === 'failed' || r.status === 'pending')
    .sort((a, b) => {
      const aStart = a.startedAt ?? '';
      const bStart = b.startedAt ?? '';
      if (aStart !== bStart) {
        return bStart.localeCompare(aStart);
      }
      return a.ordinal - b.ordinal;
    });
  const liveStep = live
    .map((r) => (r.stepId !== undefined ? stepById.get(r.stepId) : undefined))
    .find((s): s is Step => !!s);
  if (liveStep) {
    return liveStep;
  }

  const recent = [...runs].sort((a, b) => isStartedAt(b).localeCompare(isStartedAt(a)));
  const recentStep = recent
    .map((r) => (r.stepId !== undefined ? stepById.get(r.stepId) : undefined))
    .find((s): s is Step => !!s);
  if (recentStep) {
    return recentStep;
  }

  return sorted[0] ?? null;
};

export const findReusableAgent = (runs: ReadonlyArray<Agent>, stepId: Step['id']): Agent | null => {
  const matches = runs.filter((r) => r.stepId === stepId);
  if (matches.length === 0) {
    return null;
  }
  const sorted = [...matches].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  return sorted[0] ?? null;
};

export const buildStepPrompt = (input: {
  definition: Step;
  carryForwardContext: string;
  userMessage: string;
}): string => {
  const parts = [input.definition.promptPrefix, input.carryForwardContext, input.userMessage]
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.join('\n\n');
};

export type WorkflowChainState =
  | { readonly kind: 'step'; readonly step: Step }
  | { readonly kind: 'blocked'; readonly failedStep: Step }
  | { readonly kind: 'complete' };

export const classifyWorkflowChain = (
  template: Workflow,
  runs: ReadonlyArray<Agent>,
): WorkflowChainState => {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.stepId)
      .filter((id): id is Step['id'] => id !== undefined),
  );
  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  const pending = sorted.find((s) => !doneIds.has(s.id));
  if (pending === undefined) {
    return { kind: 'complete' };
  }
  const latest = findReusableAgent(runs, pending.id);
  if (latest?.status === 'failed') {
    return { kind: 'blocked', failedStep: pending };
  }
  return { kind: 'step', step: pending };
};

export const isWorkflowComplete = (template: Workflow, runs: ReadonlyArray<Agent>): boolean => {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.stepId)
      .filter((id): id is Step['id'] => id !== undefined),
  );
  return template.steps.every((d) => doneIds.has(d.id));
};

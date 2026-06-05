import type { Step, Agent, Workflow, WorkflowRunId } from '@goodboy/types';

export function runsForWorkflowRun(
  runs: ReadonlyArray<Agent>,
  workflowRunId: WorkflowRunId,
): ReadonlyArray<Agent> {
  return runs.filter((r) => r.workflowRunId === workflowRunId);
}

export function nextStep(template: Workflow, runs: ReadonlyArray<Agent>): Step | null {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.stepId)
      .filter((id): id is Step['id'] => id !== undefined),
  );

  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return sorted.find((d) => !doneIds.has(d.id)) ?? null;
}

/**
 * Resolve the step that the next user message should be routed to.
 *
 * Replaces auto-advance: the orchestrator no longer skips to the next step
 * the moment a previous one completes, it stays on whichever step has an
 * existing in-flight or last-touched run. The user explicitly spawns a new
 * agent from the sidebar to move forward; until then, every message keeps
 * iterating with the same role.
 *
 * Resolution order:
 *  1. Most recent non-terminal run (running / failed / pending) → its step.
 *  2. Most recent run regardless of status → its step (so completed steps
 *     keep accepting follow-up turns until the user acts).
 *  3. First step in the template (cold start, no runs yet).
 */
export function currentStep(template: Workflow, runs: ReadonlyArray<Agent>): Step | null {
  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  if (sorted.length === 0) return null;

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
      if (aStart !== bStart) return bStart.localeCompare(aStart);
      return a.ordinal - b.ordinal;
    });
  const liveStep = live
    .map((r) => (r.stepId !== undefined ? stepById.get(r.stepId) : undefined))
    .find((s): s is Step => !!s);
  if (liveStep) return liveStep;

  const recent = [...runs].sort((a, b) => isStartedAt(b).localeCompare(isStartedAt(a)));
  const recentStep = recent
    .map((r) => (r.stepId !== undefined ? stepById.get(r.stepId) : undefined))
    .find((s): s is Step => !!s);
  if (recentStep) return recentStep;

  return sorted[0] ?? null;
}

/**
 * Find the existing Agent row for a step that the next turn should reuse.
 *
 * An Agent is now a long-lived agent: multiple ProviderRuns get attached to
 * the same Agent row instead of inserting a new row per user message.
 * Returns the most recent run for the given step, or null if none exists yet
 * (caller should insert a fresh Agent row in that case).
 */
export function findReusableAgent(runs: ReadonlyArray<Agent>, stepId: Step['id']): Agent | null {
  const matches = runs.filter((r) => r.stepId === stepId);
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  return sorted[0] ?? null;
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

export function isWorkflowComplete(template: Workflow, runs: ReadonlyArray<Agent>): boolean {
  const doneIds = new Set(
    runs
      .filter((r) => r.status === 'completed' || r.status === 'skipped')
      .map((r) => r.stepId)
      .filter((id): id is Step['id'] => id !== undefined),
  );
  return template.steps.every((d) => doneIds.has(d.id));
}

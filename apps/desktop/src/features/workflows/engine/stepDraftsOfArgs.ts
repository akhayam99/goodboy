import { isEffortLevel } from '@goodboy/types';
import type { WorkflowStepInput } from '@goodboy/db';
import { normalizeWorkflowRole } from '@goodboy/core/roles';
import type { StepDraft } from './types';

type Params = {
  readonly steps: ReadonlyArray<WorkflowStepInput>;
};

export const stepDraftsOfArgs = ({ steps }: Params): ReadonlyArray<StepDraft> =>
  steps.map((step) => ({
    key: crypto.randomUUID(),
    sourceStepId: null,
    libraryStepId: step.libraryStepId ?? null,
    role: normalizeWorkflowRole({ role: step.role ?? 'custom' }),
    name: step.name,
    prompt: step.promptPrefix,
    expectedOutput: step.expectedOutput ?? '',
    provider: step.providerOverride ?? '',
    model: step.modelOverride ?? '',
    effort: step.effort !== undefined && isEffortLevel(step.effort) ? step.effort : 'medium',
    verbosity: step.verbosity ?? 'normal',
    size: step.size ?? null,
    orchestratorReason: step.orchestratorReason ?? null,
    routingLock: step.routingLock ?? null,
    routingDecision: step.routingDecision ?? null,
    taskProfile: step.taskProfile ?? null,
  }));

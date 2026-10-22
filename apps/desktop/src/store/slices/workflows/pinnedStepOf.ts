import { normalizeWorkflowRole, type OrchestratorStep } from '@goodboy/core';
import type { RunPreset, WorkflowRoutingLock } from '@goodboy/types';

type Params = {
  readonly step: OrchestratorStep;
  readonly preset: RunPreset | undefined;
};

type PinnedStep = Readonly<{
  step: OrchestratorStep;
  routingLock: WorkflowRoutingLock | null;
}>;

export const pinnedStepOf = ({ step, preset }: Params): PinnedStep => {
  const index = step.presetStep;
  const pinned = index === undefined ? undefined : preset?.steps[index - 1];
  if (pinned === undefined || !pinned.isPinned) {
    return { step, routingLock: null };
  }
  return {
    step: {
      ...step,
      name: pinned.name,
      role: normalizeWorkflowRole({ role: pinned.role ?? step.role }),
      promptPrefix: pinned.promptPrefix === '' ? step.promptPrefix : pinned.promptPrefix,
    },
    routingLock: pinned.routingLock,
  };
};

import { normalizeWorkflowRole, type OrchestratorStep } from '@goodboy/core';
import type { RunPreset } from '@goodboy/types';

type Params = {
  readonly step: OrchestratorStep;
  readonly preset: RunPreset | undefined;
};

export const pinnedStepOf = ({ step, preset }: Params): OrchestratorStep => {
  const index = step.presetStep;
  const pinned = index === undefined ? undefined : preset?.steps[index - 1];
  if (pinned === undefined || !pinned.isPinned) {
    return step;
  }
  return {
    ...step,
    name: pinned.name,
    role: normalizeWorkflowRole({ role: pinned.role ?? step.role }),
    promptPrefix: pinned.promptPrefix === '' ? step.promptPrefix : pinned.promptPrefix,
  };
};

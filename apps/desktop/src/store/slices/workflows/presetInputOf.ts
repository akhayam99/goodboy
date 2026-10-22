import type { OrchestratorInput } from '@goodboy/core';
import type { WorkflowRules } from '@goodboy/types';

type Params = {
  readonly rules: WorkflowRules | undefined;
};

export const presetInputOf = ({ rules }: Params): OrchestratorInput['preset'] => {
  const preset = rules?.preset;
  if (preset === undefined) {
    return undefined;
  }
  return {
    name: preset.name,
    closeness: rules?.route?.closeness ?? 'follow',
    steps: preset.steps.map((step) => ({
      name: step.name,
      role: step.role,
      isPinned: step.isPinned,
    })),
    changes: (rules?.planChanges ?? []).map((change) => ({
      kind: change.kind,
      step: change.step,
      reason: change.reason,
    })),
  };
};

import type { WorkflowDraft } from './types';

type Params = {
  readonly source: WorkflowDraft;
};

export const duplicateWorkflowDraft = ({ source }: Params): WorkflowDraft => ({
  ...source,
  name: `${source.name.trim()} copy`,
  origin: 'custom',
  isPreset: true,
  steps: source.steps.map((step) => ({
    ...step,
    key: crypto.randomUUID(),
    sourceStepId: null,
  })),
});

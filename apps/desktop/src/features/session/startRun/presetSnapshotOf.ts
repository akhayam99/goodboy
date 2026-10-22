import type { RunPreset, Workflow } from '@goodboy/types';

type Params = {
  readonly preset: Workflow;
};

export const presetSnapshotOf = ({ preset }: Params): RunPreset => ({
  workflowId: preset.id,
  name: preset.name,
  steps: [...preset.steps]
    .filter((step) => step.deletedAt == null)
    .sort((first, second) => first.ordinal - second.ordinal)
    .map((step) => ({
      name: step.name,
      role: step.role ?? null,
      promptPrefix: step.promptPrefix,
      isPinned: step.routingLock != null,
      routingLock: step.routingLock ?? null,
    })),
});

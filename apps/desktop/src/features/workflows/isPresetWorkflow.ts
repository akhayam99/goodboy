import type { Workflow } from '@goodboy/types';

export const isPresetWorkflow = (workflow: Workflow): boolean =>
  workflow.isPreset !== false && workflow.deletedAt == null;

import type { Workflow } from '@goodboy/types';
import { isPresetWorkflow } from './isPresetWorkflow';

export const isImportableWorkflow = (workflow: Workflow): boolean => {
  return isPresetWorkflow(workflow) && (workflow.origin == null || workflow.origin === 'custom');
};

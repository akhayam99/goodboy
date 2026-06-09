import type { WorkspaceId } from '@goodboy/types';
import { seedWorkflowLibrary } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const resetWorkflows = (_set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId): Promise<void> => {
    await seedWorkflowLibrary({ db: tauriDatabase }, workspaceId);
    await get().loadPhaseTemplates(workspaceId);
    await get().loadStepLibrary(workspaceId);
  };
};

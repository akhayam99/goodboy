import type { WorkspaceId } from '@goodboy/types';
import { restoreWorkflowLibrary } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const resetWorkflows = (_set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId, slugs: ReadonlyArray<string>): Promise<void> => {
    await restoreWorkflowLibrary({ db: tauriDatabase }, { workspaceId, slugs });
    await get().loadPhaseTemplates(workspaceId);
    await get().loadStepLibrary(workspaceId);
  };
};

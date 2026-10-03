import type { WorkspaceId } from '@goodboy/types';
import { restoreWorkflowLibrary } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type FactoryParams = {
  readonly get: GetFn;
};

export type ResetWorkflowsParams = {
  readonly workspaceId: WorkspaceId;
  readonly slugs: ReadonlyArray<string>;
};

export const resetWorkflows = ({ get }: FactoryParams) => {
  return async ({ workspaceId, slugs }: ResetWorkflowsParams): Promise<void> => {
    try {
      await restoreWorkflowLibrary({ db: tauriDatabase }, { workspaceId, slugs });
    } catch (error) {
      await get().reportError({
        title: "Couldn't restore built-in workflows",
        error: new Error(formatError(error)),
        workspaceId,
      });
      throw error;
    } finally {
      await get().loadPhaseTemplates(workspaceId);
      await get().loadStepLibrary(workspaceId);
    }
  };
};

import type { WorkspaceId } from '@goodboy/types';
import { seedWorkflowLibrary } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

// Restores the built-in presets (Refactor, Bug fix, Ship it, Feature,
// Exploration) to their canonical definition. Re-seeding upserts each seeded
// workflow + step by its deterministic id, so user edits are overwritten,
// removed default steps come back, and a soft-deleted default preset is
// un-deleted. User-authored custom presets keep their own ids and are left
// untouched. Reloads templates + library so the studio reflects the reset.
export function resetWorkflows(_set: SetFn, get: GetFn) {
  return async (workspaceId: WorkspaceId): Promise<void> => {
    await seedWorkflowLibrary({ db: tauriDatabase }, workspaceId);
    await get().loadPhaseTemplates(workspaceId);
    await get().loadStepLibrary(workspaceId);
  };
}

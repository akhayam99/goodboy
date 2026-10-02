import type { BootstrapPhase, ProjectId } from '@goodboy/types';
import { listSettingsWithPrefix } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from '../../slice-types';
import { bootstrapPhasePrefix, parseBootstrapPhase, projectIdOfPhaseKey } from './phase';

export const hydrateBootstrapPhases = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    const rows = await listSettingsWithPrefix(tauriDatabase, bootstrapPhasePrefix());
    const loaded: Record<ProjectId, BootstrapPhase> = {};
    for (const row of rows) {
      const projectId = projectIdOfPhaseKey(row.key);
      const phase = parseBootstrapPhase(row.value);
      if (projectId !== null && phase !== null) {
        loaded[projectId] = phase;
      }
    }
    set({ bootstrapPhase: loaded });
  };
};

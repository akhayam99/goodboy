import { getSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseCliRequirements, SETTING_CLI_REQUIREMENTS } from './cliRequirementsSetting';
import type { GetFn, SetFn } from './types';

export const hydrateCliRequirements = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    try {
      const raw = await getSetting(tauriDatabase, SETTING_CLI_REQUIREMENTS);
      set({ cliRequirements: parseCliRequirements({ raw }) });
    } catch {
      set({ cliRequirements: [] });
    }
  };
};

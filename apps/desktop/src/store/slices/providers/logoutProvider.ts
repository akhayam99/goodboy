import type { ProviderId } from '@goodboy/types';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { runLifecycle } from './runLifecycle';
import type { GetFn, SetFn } from './types';

export const logoutProvider = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    await runLifecycle(set, get, { providerId, action: 'logout' });
    if (providerId === 'cursor') {
      cursorMaxModeAdvisory.clearAll({});
    }
  };
};

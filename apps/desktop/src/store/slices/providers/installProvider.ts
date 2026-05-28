import type { ProviderId } from '@goodboy/types';
import { runLifecycle } from './runLifecycle';
import type { GetFn, SetFn } from './types';

export function installProvider(set: SetFn, get: GetFn) {
  return (providerId: ProviderId): Promise<void> =>
    runLifecycle(set, get, { providerId, action: 'install' });
}

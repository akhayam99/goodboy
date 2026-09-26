import { listDisconnectedWorkspaces } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadDisconnectedWorkspaces = (set: SetFn) => {
  return async (): Promise<void> => {
    const disconnectedWorkspaces = await listDisconnectedWorkspaces({ db: tauriDatabase });
    set({ disconnectedWorkspaces });
  };
};

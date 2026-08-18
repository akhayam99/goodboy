import { countWorkspacesPerIntegrationCredential, listIntegrationCredentials } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadIntegrationCredentials = (set: SetFn) => {
  return async (): Promise<void> => {
    const [integrationCredentials, integrationCredentialUsage] = await Promise.all([
      listIntegrationCredentials(tauriDatabase),
      countWorkspacesPerIntegrationCredential(tauriDatabase),
    ]);
    set({ integrationCredentials, integrationCredentialUsage });
  };
};

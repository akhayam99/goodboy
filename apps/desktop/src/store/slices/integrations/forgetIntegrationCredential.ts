import { invoke } from '@tauri-apps/api/core';
import { deleteIntegrationCredential } from '@goodboy/db';
import type { IntegrationCredentialId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { credentialInUseMessage } from '../../../shared/utils/credentialInUseMessage';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly credentialId: IntegrationCredentialId;
};

export const forgetIntegrationCredential = (set: SetFn, get: GetFn) => {
  return async ({ credentialId }: Params): Promise<void> => {
    const usedBy = get().integrationCredentialUsage[credentialId] ?? 0;
    if (usedBy > 0) {
      throw new Error(credentialInUseMessage({ usedBy }));
    }
    await deleteIntegrationCredential(tauriDatabase, credentialId);
    await invoke('integration_credential_forget', { credentialId });
    set((state) => {
      const { [credentialId]: _removed, ...usage } = state.integrationCredentialUsage;
      return {
        integrationCredentials: state.integrationCredentials.filter(
          (credential) => credential.id !== credentialId,
        ),
        integrationCredentialUsage: usage,
      };
    });
  };
};

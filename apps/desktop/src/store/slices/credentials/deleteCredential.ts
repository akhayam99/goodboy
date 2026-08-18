import { invoke } from '@tauri-apps/api/core';
import { deleteProviderCredential } from '@goodboy/db';
import type { CredentialId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { credentialSecretKey } from './credentialKey';
import { credentialInUseMessage } from '../../../shared/utils/credentialInUseMessage';
import type { GetFn, SetFn } from './types';

export const deleteCredential = (set: SetFn, get: GetFn) => {
  return async (id: CredentialId): Promise<void> => {
    const usedBy = Object.values(get().workspaceOverrides).filter((override) => {
      const bindings = override.providerBindings;
      if (bindings === null || bindings === undefined) {
        return false;
      }
      return Object.values(bindings).includes(id);
    }).length;

    if (usedBy > 0) {
      throw new Error(credentialInUseMessage({ usedBy }));
    }

    await invoke('secret_delete', { key: credentialSecretKey(id) });
    await deleteProviderCredential(tauriDatabase, id);

    set((state) => ({
      providerCredentials: state.providerCredentials.filter((c) => c.id !== id),
    }));
  };
};

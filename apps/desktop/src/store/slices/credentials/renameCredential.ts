import { renameProviderCredential } from '@goodboy/db';
import type { CredentialId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const renameCredential = (set: SetFn) => {
  return async (id: CredentialId, label: string): Promise<void> => {
    const trimmed = label.trim() || 'api key';
    await renameProviderCredential(tauriDatabase, id, trimmed);
    set((state) => ({
      providerCredentials: state.providerCredentials.map((c) =>
        c.id === id ? { ...c, label: trimmed } : c,
      ),
    }));
  };
};

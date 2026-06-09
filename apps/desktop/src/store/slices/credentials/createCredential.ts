import { invoke } from '@tauri-apps/api/core';
import { insertProviderCredential } from '@goodboy/db';
import type { CredentialId, IsoDateTime, ProviderCredential, ProviderId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { credentialSecretKey, maskApiKey } from './credentialKey';
import type { SetFn } from './types';

type ApiKeyCheck = {
  readonly valid: boolean;
  readonly message: string | null;
};

export const createCredential = (set: SetFn) => {
  return async (
    providerId: ProviderId,
    label: string,
    apiKey: string,
  ): Promise<ProviderCredential> => {
    const check = await invoke<ApiKeyCheck>('provider_api_key_validate', {
      providerId,
      apiKey: apiKey.trim(),
    });
    if (!check.valid) {
      throw new Error(check.message ?? 'API key validation failed');
    }
    const credential: ProviderCredential = {
      id: crypto.randomUUID() as CredentialId,
      providerId,
      label: label.trim() || 'api key',
      hint: maskApiKey(apiKey),
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    await invoke('secret_set', { key: credentialSecretKey(credential.id), value: apiKey.trim() });
    await insertProviderCredential(tauriDatabase, credential);
    set((state) => ({ providerCredentials: [...state.providerCredentials, credential] }));
    return credential;
  };
};

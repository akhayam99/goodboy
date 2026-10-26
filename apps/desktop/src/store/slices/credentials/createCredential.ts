import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { insertProviderCredential } from '@goodboy/db';
import type { CredentialId, IsoDateTime, ProviderCredential, ProviderId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { credentialSecretKey, maskApiKey } from './credentialKey';
import type { SetFn } from './types';

type ApiKeyCheck = {
  readonly status: 'valid' | 'rejected' | 'unchecked';
  readonly message: string | null;
};

export const createCredential = (set: SetFn) => {
  return async (
    providerId: ProviderId,
    label: string,
    apiKey: string,
  ): Promise<ProviderCredential> => {
    const check = await invokeCommand<ApiKeyCheck>('provider_api_key_validate', {
      providerId,
      apiKey: apiKey.trim(),
    });
    if (check.status === 'rejected') {
      throw new Error(check.message ?? 'API key validation failed');
    }
    const credential: ProviderCredential = {
      id: crypto.randomUUID() as CredentialId,
      providerId,
      label: label.trim() || 'api key',
      hint: maskApiKey(apiKey),
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    const secretKey = credentialSecretKey(credential.id);
    await invokeCommand('secret_set', {
      key: secretKey,
      value: apiKey.trim(),
    });
    try {
      await insertProviderCredential(tauriDatabase, credential);
    } catch (error) {
      try {
        await invokeCommand('secret_delete', { key: secretKey });
      } catch {
        throw new Error('the key was saved to the password store but could not be removed again');
      }
      throw error;
    }
    set((state) => ({ providerCredentials: [...state.providerCredentials, credential] }));
    return credential;
  };
};

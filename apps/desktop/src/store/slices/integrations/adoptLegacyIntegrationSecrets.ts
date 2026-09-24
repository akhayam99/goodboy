import { invoke } from '@tauri-apps/api/core';

export type AdoptLegacyIntegrationSecretsResult =
  { readonly ok: true } | { readonly ok: false; readonly error: unknown };

export const adoptLegacyIntegrationSecrets =
  async (): Promise<AdoptLegacyIntegrationSecretsResult> => {
    try {
      await invoke<number>('integration_credentials_adopt');
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  };

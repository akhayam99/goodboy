import { invoke } from '@tauri-apps/api/core';

export const adoptLegacyIntegrationSecrets = async (): Promise<void> => {
  try {
    await invoke<number>('integration_credentials_adopt');
  } catch {
    return;
  }
};

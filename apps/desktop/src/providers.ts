import { invoke } from '@tauri-apps/api/core';

export interface ProviderStatus {
  readonly id: string;
  readonly binary: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly error: string | null;
}

export async function getProviderStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('get_provider_status');
}

export async function refreshProviderStatus(): Promise<ProviderStatus> {
  return invoke<ProviderStatus>('refresh_provider_status');
}

import { invoke } from '@tauri-apps/api/core';

export async function setSecret(key: string, value: string): Promise<void> {
  await invoke('secret_set', { key, value });
}

export async function deleteSecret(key: string): Promise<void> {
  await invoke('secret_delete', { key });
}

export async function hasSecret(key: string): Promise<boolean> {
  return await invoke<boolean>('secret_has', { key });
}

export async function getSecret(key: string): Promise<string | null> {
  return await invoke<string | null>('secret_get', { key });
}

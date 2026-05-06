import { invoke } from '@tauri-apps/api/core';

export async function setSecret(key: string, value: string): Promise<void> {
  await invoke('secret_set', { key, value });
}

export async function deleteSecret(key: string): Promise<void> {
  await invoke('secret_delete', { key });
}

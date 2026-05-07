import { invoke } from '@tauri-apps/api/core';

export async function openInEditor(path: string, editor?: string): Promise<void> {
  await invoke('open_in_editor', { path, editor: editor ?? null });
}

export async function openUrl(url: string): Promise<void> {
  await invoke('open_url', { url });
}

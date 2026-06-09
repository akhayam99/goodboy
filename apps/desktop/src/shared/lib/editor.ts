import { invoke } from '@tauri-apps/api/core';

export type DetectedEditor = {
  readonly binary: string;
  readonly label: string;
};

export async function detectEditors(): Promise<ReadonlyArray<DetectedEditor>> {
  return invoke<DetectedEditor[]>('detect_editors');
}

export async function openInEditor(path: string, editor?: string): Promise<void> {
  await invoke('open_in_editor', { path, editor: editor ?? null });
}

export async function openFileInWorkspace(
  workspacePath: string,
  filePath: string,
  editor?: string,
): Promise<void> {
  await invoke('open_file_in_workspace', {
    workspacePath,
    filePath,
    editor: editor ?? null,
  });
}

export async function openUrl(url: string): Promise<void> {
  await invoke('open_url', { url });
}

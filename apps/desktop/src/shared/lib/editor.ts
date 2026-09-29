import { invoke } from '@tauri-apps/api/core';

export type DetectedEditor = {
  readonly binary: string;
  readonly label: string;
};

export const detectEditors = async (): Promise<ReadonlyArray<DetectedEditor>> => {
  return invoke<DetectedEditor[]>('detect_editors');
};

type OpenInEditorParams = {
  readonly path: string;
  readonly editor: string;
};

export const openInEditor = async ({ path, editor }: OpenInEditorParams): Promise<void> => {
  await invoke('open_in_editor', { path, editor });
};

export const openFileInWorkspace = async (
  workspacePath: string,
  filePath: string,
  editor: string,
): Promise<void> => {
  await invoke('open_file_in_workspace', {
    workspacePath,
    filePath,
    editor,
  });
};

export const openUrl = async (url: string): Promise<void> => {
  await invoke('open_url', { url });
};

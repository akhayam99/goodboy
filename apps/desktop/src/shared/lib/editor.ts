import { invokeCommand } from './invokeCommand';

export type DetectedEditor = {
  readonly binary: string;
  readonly label: string;
};

export const detectEditors = async (): Promise<ReadonlyArray<DetectedEditor>> => {
  return invokeCommand<DetectedEditor[]>('detect_editors');
};

type OpenInEditorParams = {
  readonly path: string;
  readonly editor?: string;
};

export const openInEditor = async ({ path, editor }: OpenInEditorParams): Promise<void> => {
  await invokeCommand('open_in_editor', { path, editor: editor ?? null });
};

export const openFileInWorkspace = async (
  workspacePath: string,
  filePath: string,
  editor?: string,
): Promise<void> => {
  await invokeCommand('open_file_in_workspace', {
    workspacePath,
    filePath,
    editor: editor ?? null,
  });
};

export const openUrl = async (url: string): Promise<void> => {
  await invokeCommand('open_url', { url });
};

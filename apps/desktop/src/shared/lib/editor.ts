import { invokeCommand } from './invokeCommand';

export type DetectedEditor = {
  readonly binary: string;
  readonly label: string;
};

export const detectEditors = async (): Promise<ReadonlyArray<DetectedEditor>> => {
  return invokeCommand<DetectedEditor[]>('detect_editors');
};

export type DetectedBrowser = {
  readonly id: string;
  readonly label: string;
};

export const detectBrowsers = async (): Promise<ReadonlyArray<DetectedBrowser>> => {
  return invokeCommand<DetectedBrowser[]>('detect_browsers');
};

type OpenInEditorParams = {
  readonly path: string;
  readonly editor: string;
};

export const openInEditor = async ({ path, editor }: OpenInEditorParams): Promise<void> => {
  await invokeCommand('open_in_editor', { path, editor });
};

type OpenFileInWorkspaceParams = {
  readonly workspacePath: string;
  readonly filePath: string;
  readonly editor: string;
  readonly line?: number;
  readonly column?: number;
};

export const openFileInWorkspace = async ({
  workspacePath,
  filePath,
  editor,
  line,
  column,
}: OpenFileInWorkspaceParams): Promise<void> => {
  await invokeCommand('open_file_in_workspace', {
    workspacePath,
    filePath,
    editor,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  });
};

export const openUrl = async (url: string): Promise<void> => {
  await invokeCommand('open_url', { url });
};

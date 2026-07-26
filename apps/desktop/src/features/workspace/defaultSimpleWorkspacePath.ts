import { invoke } from '@tauri-apps/api/core';

type Params = {
  name: string;
};

export const defaultSimpleWorkspacePath = async ({ name }: Params): Promise<string> => {
  return invoke<string>('simple_workspace_default_path', { name });
};

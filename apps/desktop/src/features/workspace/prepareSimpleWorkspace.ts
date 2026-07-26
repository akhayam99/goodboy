import { invoke } from '@tauri-apps/api/core';

type Params = {
  path: string;
};

export const prepareSimpleWorkspace = async ({ path }: Params): Promise<string> => {
  return invoke<string>('simple_workspace_prepare', { path });
};

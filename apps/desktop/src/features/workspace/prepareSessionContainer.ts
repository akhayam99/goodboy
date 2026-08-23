import { invoke } from '@tauri-apps/api/core';

type Params = {
  path: string;
};

export const prepareSessionContainer = async ({ path }: Params): Promise<string> => {
  return invoke<string>('session_container_prepare', { path });
};

import { invoke } from '@tauri-apps/api/core';

type Params = {
  readonly url: string;
};

export const loadRemoteImage = async ({ url }: Params): Promise<string> => {
  return invoke<string>('fetch_remote_image', { url });
};

import { invoke } from '@tauri-apps/api/core';

type RevealInFileManagerParams = {
  readonly path: string;
};

export const revealInFileManager = async ({ path }: RevealInFileManagerParams): Promise<void> => {
  await invoke('reveal_in_file_manager', { path });
};

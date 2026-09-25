import { invoke } from '@tauri-apps/api/core';

export type AppDataUsage = {
  readonly folder: string;
  readonly databaseBytes: number;
  readonly snapshotBytes: number;
  readonly snapshotCount: number;
};

export const appDataUsage = async (): Promise<AppDataUsage> =>
  invoke<AppDataUsage>('app_data_usage');

type RevealParams = {
  readonly path: string;
};

export const revealInFileManager = async ({ path }: RevealParams): Promise<void> => {
  await invoke('reveal_in_file_manager', { path });
};

import { invoke } from '@tauri-apps/api/core';

export type AppDataUsage = {
  readonly folder: string;
  readonly databaseBytes: number;
  readonly snapshotBytes: number;
  readonly snapshotCount: number;
};

export const appDataUsage = async (): Promise<AppDataUsage> =>
  invoke<AppDataUsage>('app_data_usage');

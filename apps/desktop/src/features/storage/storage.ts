import { invokeCommand } from '../../shared/lib/invokeCommand';

export type AppDataUsage = {
  readonly folder: string;
  readonly databaseBytes: number;
  readonly snapshotBytes: number;
  readonly snapshotCount: number;
};

export const appDataUsage = async (): Promise<AppDataUsage> =>
  invokeCommand<AppDataUsage>('app_data_usage');

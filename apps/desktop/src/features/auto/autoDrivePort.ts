import type { AutoTreeId } from '@goodboy/types';

type DriveParams = {
  readonly treeId: AutoTreeId;
};

export type AutoDrivePort = (params: DriveParams) => Promise<void>;

type Registry = {
  port: AutoDrivePort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: AutoDrivePort | null;
};

export const registerAutoDrivePort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentAutoDrivePort = (): AutoDrivePort | null => registry.port;

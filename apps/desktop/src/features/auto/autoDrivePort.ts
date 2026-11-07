import type { AutoTreeId } from '@goodboy/types';
import { createPort } from './createPort';

type DriveParams = {
  readonly treeId: AutoTreeId;
};

export type AutoDrivePort = (params: DriveParams) => Promise<void>;

const slot = createPort<AutoDrivePort>();

export const registerAutoDrivePort = slot.register;

export const currentAutoDrivePort = slot.current;

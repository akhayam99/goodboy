import type { MountSnapshot } from '@goodboy/core';
import type { AutoPorts } from './ports';

export type ReadSnapshotParams = Readonly<{
  ports: AutoPorts;
  worktreePath: string;
}>;

export const readSnapshot = async ({
  ports,
  worktreePath,
}: ReadSnapshotParams): Promise<MountSnapshot | null> => {
  try {
    return await ports.readMountSnapshot({ worktreePath });
  } catch {
    return null;
  }
};

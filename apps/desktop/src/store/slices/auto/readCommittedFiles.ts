import type { MountSnapshot } from '@goodboy/core';
import type { AutoPorts } from './ports';

export type ReadCommittedFilesOfParams = Readonly<{
  ports: AutoPorts;
  worktreePath: string;
  baseline: MountSnapshot | null;
  result: MountSnapshot | null;
}>;

export const readCommittedFilesOf = async ({
  ports,
  worktreePath,
  baseline,
  result,
}: ReadCommittedFilesOfParams): Promise<ReadonlyArray<string> | null> => {
  if (baseline === null || result === null) {
    return null;
  }
  if (baseline.head === result.head) {
    return [];
  }
  try {
    return await ports.readCommittedFiles({
      worktreePath,
      base: baseline.head,
      head: result.head,
    });
  } catch {
    return null;
  }
};

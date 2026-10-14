import { inspectWorktree, sessionDirExists } from '../../../features/worktree/worktree';

type Params = {
  readonly repoPath: string;
  readonly parentDir: string;
  readonly dirName: string;
};

export const isMountDirTaken = async ({
  repoPath,
  parentDir,
  dirName,
}: Params): Promise<boolean> => {
  const path = `${parentDir}/${dirName}`;
  const isExisting = await sessionDirExists({ path });
  if (isExisting !== true) {
    return false;
  }
  const inspection = await inspectWorktree({ repoPath, worktreePath: path });
  return inspection.kind !== 'registered';
};

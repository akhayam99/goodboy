import { readHistoryCopyGitDirs } from '../../../features/history/historyEngine';

type Params = {
  readonly copyPath: string;
};

export const rewriterWritableRoots = async ({
  copyPath,
}: Params): Promise<ReadonlyArray<string>> => {
  const dirs = await readHistoryCopyGitDirs({ copyPath }).catch(() => null);
  return dirs === null ? [copyPath] : [copyPath, dirs.gitDir, dirs.objectsDir, dirs.packedRefsLock];
};

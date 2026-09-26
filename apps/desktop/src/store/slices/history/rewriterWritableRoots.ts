import { gitCommonDirectory } from '../../../features/worktree/worktree';

type Params = {
  readonly copyPath: string;
};

export const rewriterWritableRoots = async ({
  copyPath,
}: Params): Promise<ReadonlyArray<string>> => {
  const common = await gitCommonDirectory({ repoPath: copyPath }).catch(() => null);
  return common === null || common === '' ? [] : [common];
};

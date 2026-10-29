import { gitRemoteNames } from './gitRemoteNames';
import { remoteBranchName } from './remoteBranchName';

type Params = {
  readonly candidates: ReadonlyArray<string | null | undefined>;
  readonly cwd: string;
};

export const requestBaseBranchOf = async ({
  candidates,
  cwd,
}: Params): Promise<string | undefined> => {
  const chosen = candidates
    .map((candidate) => candidate?.trim() ?? '')
    .find((candidate) => candidate !== '');
  if (chosen === undefined) {
    return undefined;
  }
  const remotes = await gitRemoteNames({ cwd });
  const branch = remoteBranchName({ ref: chosen, remotes });
  return branch === '' ? undefined : branch;
};

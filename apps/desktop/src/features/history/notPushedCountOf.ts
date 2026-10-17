import type { BranchCommit } from '@goodboy/types';

type Params = {
  readonly commits: ReadonlyArray<Pick<BranchCommit, 'pushed'>> | null;
  readonly hasUpstream: boolean;
};

export const notPushedCountOf = ({ commits, hasUpstream }: Params): number | null => {
  if (commits === null || !hasUpstream) {
    return null;
  }
  return commits.filter((commit) => !commit.pushed).length;
};

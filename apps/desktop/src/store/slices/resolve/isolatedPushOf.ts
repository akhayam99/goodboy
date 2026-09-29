import type { BranchCommit } from '@goodboy/types';

export type IsolatedPush = {
  readonly tip: string;
  readonly pushed: ReadonlyArray<BranchCommit>;
  readonly fixes: ReadonlyArray<BranchCommit>;
  readonly earlier: ReadonlyArray<BranchCommit>;
};

type Params = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly fixShas: ReadonlyArray<string>;
};

export const isolatedPushOf = ({ commits, fixShas }: Params): IsolatedPush | null => {
  const fix = new Set(fixShas);
  const outgoing = commits.filter((commit) => !commit.pushed);
  const tipIndex = outgoing.findIndex((commit) => fix.has(commit.sha));
  const tip = outgoing[tipIndex];
  if (tip === undefined) {
    return null;
  }
  const pushed = outgoing.slice(tipIndex);
  return {
    tip: tip.sha,
    pushed,
    fixes: pushed.filter((commit) => fix.has(commit.sha)),
    earlier: pushed.filter((commit) => !fix.has(commit.sha)),
  };
};

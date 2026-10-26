import type { SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly mount: SessionProjectMount;
  readonly name: string;
  readonly branch: string;
  readonly index: number;
};

export const storyMountOf = ({ mount, name, branch, index }: Params): SessionProjectMount => ({
  ...mount,
  mountName: name,
  branch,
  parallelIndex: index,
  worktreePath: `~/code/harborline/${name}-${branch.split('/').at(-1) ?? 'work'}`,
  repoRoot: `~/code/harborline/${name}`,
});

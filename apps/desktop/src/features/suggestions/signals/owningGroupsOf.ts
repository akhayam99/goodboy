import type { ScriptGroup } from '../../scripts/scripts';

type Params = {
  readonly groups: ReadonlyArray<ScriptGroup>;
  readonly path: string;
};

type OwnsParams = {
  readonly group: ScriptGroup;
  readonly path: string;
};

const isOwnedBy = ({ group, path }: OwnsParams): boolean =>
  group.relDir === '' || path === group.relDir || path.startsWith(`${group.relDir}/`);

export const owningGroupsOf = ({ groups, path }: Params): ReadonlyArray<ScriptGroup> =>
  groups
    .filter((group) => isOwnedBy({ group, path }))
    .sort((first, second) => second.relDir.length - first.relDir.length);

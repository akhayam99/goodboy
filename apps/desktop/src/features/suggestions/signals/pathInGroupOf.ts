import type { ScriptGroup } from '../../scripts/scripts';

type Params = {
  readonly group: ScriptGroup;
  readonly path: string;
};

export const pathInGroupOf = ({ group, path }: Params): string =>
  group.relDir === '' || !path.startsWith(`${group.relDir}/`)
    ? path
    : path.slice(group.relDir.length + 1);

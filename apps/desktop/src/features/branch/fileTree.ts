import type { FileDiff } from '@goodboy/types';
import { splitPath } from '../diff/lib/fileStatus';

export type FileTreeGroup = {
  readonly dir: string;
  readonly files: ReadonlyArray<FileDiff>;
};

export const fileTreeGroups = ({
  files,
}: {
  readonly files: ReadonlyArray<FileDiff>;
}): ReadonlyArray<FileTreeGroup> => {
  const byDir = new Map<string, FileDiff[]>();
  for (const file of files) {
    const dir = splitPath(file.path).dir.replace(/\/$/, '');
    byDir.set(dir, [...(byDir.get(dir) ?? []), file]);
  }
  return [...byDir.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dir, group]) => ({
      dir,
      files: [...group].sort((left, right) =>
        splitPath(left.path).name.localeCompare(splitPath(right.path).name),
      ),
    }));
};

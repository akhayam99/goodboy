import type { BoardRow } from './boardTypes';

export type ProjectSection = Readonly<{
  projectName: string | null;
  rowIds: ReadonlyArray<string>;
}>;

type Params = {
  readonly rowIds: ReadonlyArray<string>;
  readonly rowById: ReadonlyMap<string, BoardRow>;
};

export const projectSectionsOf = ({ rowIds, rowById }: Params): ReadonlyArray<ProjectSection> => {
  const byName = new Map<string | null, Array<string>>();
  for (const rowId of rowIds) {
    const projectName = rowById.get(rowId)?.projectName ?? null;
    byName.set(projectName, [...(byName.get(projectName) ?? []), rowId]);
  }
  return [...byName].map(([projectName, ids]) => ({ projectName, rowIds: ids }));
};

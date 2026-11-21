import type { ProjectId } from '@goodboy/types';
import type { BoardRow } from './boardTypes';

export type ProjectSection = Readonly<{
  projectId: ProjectId | null;
  projectName: string | null;
  rowIds: ReadonlyArray<string>;
}>;

type Params = {
  readonly rowIds: ReadonlyArray<string>;
  readonly rowById: ReadonlyMap<string, BoardRow>;
};

export const projectSectionsOf = ({ rowIds, rowById }: Params): ReadonlyArray<ProjectSection> => {
  const byId = new Map<ProjectId | null, ProjectSection>();
  for (const rowId of rowIds) {
    const row = rowById.get(rowId);
    const projectId = row?.projectId ?? null;
    const section = byId.get(projectId);
    byId.set(projectId, {
      projectId,
      projectName: section?.projectName ?? row?.projectName ?? null,
      rowIds: [...(section?.rowIds ?? []), rowId],
    });
  }
  return [...byId.values()];
};

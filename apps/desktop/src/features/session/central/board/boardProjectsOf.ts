import type { ProjectId } from '@goodboy/types';
import type { BoardRow } from './boardTypes';

export type BoardProject = Readonly<{
  projectId: ProjectId;
  projectName: string;
}>;

type Params = {
  readonly rows: ReadonlyArray<BoardRow>;
};

export const boardProjectsOf = ({ rows }: Params): ReadonlyArray<BoardProject> => [
  ...new Map(
    rows.flatMap((row) =>
      row.projectId === null || row.projectName === null
        ? []
        : [[row.projectId, { projectId: row.projectId, projectName: row.projectName }] as const],
    ),
  ).values(),
];

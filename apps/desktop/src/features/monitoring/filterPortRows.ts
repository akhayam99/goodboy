import type { PortRow } from '@goodboy/core';

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly query: string;
  readonly projectNameOf: (projectId: string | null) => string | null;
};

export const filterPortRows = ({ rows, query, projectNameOf }: Params): ReadonlyArray<PortRow> => {
  const needle = query.trim().toLowerCase().replace(/^:/, '');
  if (needle === '') {
    return rows;
  }
  return rows.filter((row) => {
    if (String(row.port).includes(needle)) {
      return true;
    }
    const project = projectNameOf(row.projectId);
    return project !== null && project.toLowerCase().includes(needle);
  });
};

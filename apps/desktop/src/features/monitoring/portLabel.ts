import type { PortRow } from '@goodboy/core';

type Params = {
  readonly row: PortRow;
};

export const portLabel = ({ row }: Params): string =>
  row.label !== null && row.label !== `:${row.port}` ? row.label : '';

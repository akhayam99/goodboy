import type { PortColumn, PortColumns } from './portColumns';

const SHOWN: Readonly<Record<PortColumns, ReadonlyArray<PortColumn>>> = {
  full: ['label', 'up', 'cpu', 'memory'],
  compact: ['cpu', 'memory'],
  narrow: [],
};

type Params = {
  readonly columns: PortColumns;
  readonly column: PortColumn;
};

export const isPortColumnShown = ({ columns, column }: Params): boolean =>
  SHOWN[columns].includes(column);

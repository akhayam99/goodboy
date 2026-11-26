import { DOCK_GRID_CAP } from './dockGridCap';
import type { DockMoveTarget } from './dockMoveTarget';

type Columns = ReadonlyArray<ReadonlyArray<string>>;

type ColumnsParams = {
  readonly columns: Columns;
};

type Params = ColumnsParams & {
  readonly key: string;
  readonly target: DockMoveTarget;
  readonly isDetached?: boolean;
};

const shapeOf = ({ columns }: ColumnsParams): string => JSON.stringify(columns);

const fitsCap = ({ columns }: ColumnsParams): boolean =>
  columns.length <= DOCK_GRID_CAP.columns &&
  columns.every((column) => column.length > 0 && column.length <= DOCK_GRID_CAP.rows);

const movedOf = ({ columns, key, target, isDetached = false }: Params): Columns | null => {
  const isPresent = columns.some((column) => column.includes(key));
  if (!isPresent && !isDetached) {
    return null;
  }
  if (target.at === 'swap') {
    if (!isPresent) {
      return null;
    }
    if (!columns.some((column) => column.includes(target.key))) {
      return null;
    }
    return columns.map((column) =>
      column.map((candidate) => {
        if (candidate === key) {
          return target.key;
        }
        return candidate === target.key ? key : candidate;
      }),
    );
  }
  const rest = columns
    .map((column) => column.filter((candidate) => candidate !== key))
    .filter((column) => column.length > 0);
  if (target.at === 'page') {
    return [[key], ...rest];
  }
  if (target.at === 'tab') {
    return isPresent && key !== target.key && rest.some((column) => column.includes(target.key))
      ? rest
      : null;
  }
  const index = rest.findIndex((column) => column.includes(target.key));
  const column = rest[index];
  if (column === undefined) {
    return null;
  }
  if (target.at === 'beside') {
    const at = target.side === 'before' ? index : index + 1;
    return [...rest.slice(0, at), [key], ...rest.slice(at)];
  }
  if (column.length >= DOCK_GRID_CAP.rows) {
    return null;
  }
  const stacked = target.at === 'above' ? [key, ...column] : [...column, key];
  return rest.map((candidate, at) => (at === index ? stacked : candidate));
};

export const dockColumnsAfterMove = ({
  columns,
  key,
  target,
  isDetached,
}: Params): Columns | null => {
  const moved = movedOf({ columns, key, target, isDetached });
  if (moved === null || !fitsCap({ columns: moved })) {
    return null;
  }
  return shapeOf({ columns: moved }) === shapeOf({ columns }) ? null : moved;
};

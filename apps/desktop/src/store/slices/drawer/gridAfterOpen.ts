import { DOCK_GRID_CAP } from '@goodboy/ui';
import { DRAWER_KINDS } from './drawerKinds';
import type { DrawerGrid, OpenDrawer } from './state';
import { toolsByUseOf } from './toolsByUseOf';

type Params = {
  readonly grid: DrawerGrid;
  readonly entry: OpenDrawer;
};

type Columns = DrawerGrid['columns'];

type Column = Columns[number];

type ColumnsParams = {
  readonly columns: Columns;
};

type ColumnParams = {
  readonly column: Column;
};

type SwapParams = ColumnsParams & {
  readonly kind: OpenDrawer['kind'];
  readonly entry: OpenDrawer;
};

type Candidate = {
  readonly column: Column;
  readonly index: number;
};

type PickParams = {
  readonly pick: Candidate | null;
  readonly candidate: Candidate;
};

const GRID_CAP = DOCK_GRID_CAP.columns * DOCK_GRID_CAP.rows;

const swapped = ({ columns, kind, entry }: SwapParams): Columns =>
  columns.map((column) => column.map((panel) => (panel.kind === kind ? entry : panel)));

const holdsBrowser = ({ column }: ColumnParams): boolean =>
  column.some((panel) => DRAWER_KINDS[panel.kind].sizing === 'browser');

const roomierOf = ({ pick, candidate }: PickParams): Candidate => {
  if (pick === null || candidate.column.length < pick.column.length) {
    return candidate;
  }
  if (candidate.column.length > pick.column.length) {
    return pick;
  }
  const isCandidateBrowser = holdsBrowser({ column: candidate.column });
  if (isCandidateBrowser !== holdsBrowser({ column: pick.column })) {
    return isCandidateBrowser ? pick : candidate;
  }
  return candidate;
};

const lowerColumnOf = ({ columns }: ColumnsParams): number =>
  columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.length < DOCK_GRID_CAP.rows)
    .reduce<Candidate | null>((pick, candidate) => roomierOf({ pick, candidate }), null)?.index ??
  -1;

const placed = ({ columns, entry }: ColumnsParams & Pick<Params, 'entry'>): Columns => {
  if (columns.length < DOCK_GRID_CAP.columns) {
    return [...columns, [entry]];
  }
  const target = lowerColumnOf({ columns });
  return columns.map((column, index) => (index === target ? [...column, entry] : column));
};

export const gridAfterOpen = ({ grid, entry }: Params): DrawerGrid => {
  const focus = { at: 'tool', kind: entry.kind } as const;
  const isOpen = grid.columns.some((column) => column.some((panel) => panel.kind === entry.kind));
  if (isOpen) {
    return {
      columns: swapped({ columns: grid.columns, kind: entry.kind, entry }),
      used: [...grid.used.filter((kind) => kind !== entry.kind), entry.kind],
      focus,
      widths: grid.widths,
    };
  }
  if (grid.columns.flat().length < GRID_CAP) {
    return {
      columns: placed({ columns: grid.columns, entry }),
      used: [...grid.used, entry.kind],
      focus,
      widths: grid.widths,
    };
  }
  const oldest = toolsByUseOf({ grid })[0]?.kind ?? entry.kind;
  return {
    columns: swapped({ columns: grid.columns, kind: oldest, entry }),
    used: [...grid.used.filter((kind) => kind !== oldest), entry.kind],
    focus,
    widths: grid.widths,
  };
};

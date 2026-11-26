import { DOCK_GRID_CAP } from '@goodboy/ui';
import { DRAWER_KINDS } from './drawerKinds';
import { layoutOf } from './dockTabs/layoutOf';
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

const isRowColumn = ({ column }: ColumnParams): boolean =>
  column.every((panel) => DRAWER_KINDS[panel.kind].place === 'row');

const rowColumnOf = ({ columns }: ColumnsParams): number =>
  columns.findIndex((column) => isRowColumn({ column }) && column.length < DOCK_GRID_CAP.rows);

const placed = ({ columns, entry }: ColumnsParams & Pick<Params, 'entry'>): Columns => {
  const shared = DRAWER_KINDS[entry.kind].place === 'row' ? rowColumnOf({ columns }) : -1;
  if (shared >= 0) {
    return columns.map((column, index) => (index === shared ? [...column, entry] : column));
  }
  if (columns.length < DOCK_GRID_CAP.columns) {
    return [...columns, [entry]];
  }
  const target = lowerColumnOf({ columns });
  return columns.map((column, index) => (index === target ? [...column, entry] : column));
};

type AttachParams = {
  readonly columns: Columns;
  readonly grid: DrawerGrid;
};

type JoinParams = {
  readonly grid: DrawerGrid;
  readonly entry: OpenDrawer;
  readonly lead: OpenDrawer['kind'];
};

const attached = ({ columns, grid }: AttachParams): Columns => {
  const all = grid.columns.flat();
  return columns.map((column) =>
    column.flatMap((panel) => {
      const keys = grid.tabs?.[panel.kind]?.keys ?? [];
      const members = keys
        .filter((key) => key !== panel.kind)
        .flatMap((key) => all.find((candidate) => candidate.kind === key) ?? []);
      return [panel, ...members];
    }),
  );
};

const joined = ({ grid, entry, lead }: JoinParams): DrawerGrid => {
  const known = grid.tabs ?? {};
  const keys = [...(known[lead]?.keys ?? [lead]), entry.kind];
  return {
    columns: grid.columns.map((column) =>
      column.some((panel) => panel.kind === lead) ? [...column, entry] : column,
    ),
    used: [...grid.used, entry.kind],
    focus: { at: 'tool', kind: entry.kind },
    widths: grid.widths,
    splits: grid.splits,
    tabs: { ...known, [lead]: { keys, active: entry.kind } },
  };
};

export const gridAfterOpen = ({ grid, entry }: Params): DrawerGrid => {
  const focus = { at: 'tool', kind: entry.kind } as const;
  const tabs = grid.tabs === undefined ? {} : { tabs: grid.tabs };
  const isOpen = grid.columns.some((column) => column.some((panel) => panel.kind === entry.kind));
  if (isOpen) {
    return {
      columns: swapped({ columns: grid.columns, kind: entry.kind, entry }),
      used: [...grid.used.filter((kind) => kind !== entry.kind), entry.kind],
      focus,
      widths: grid.widths,
      splits: grid.splits,
      ...tabs,
    };
  }
  const layout = layoutOf({ columns: grid.columns, tabs: grid.tabs });
  if (layout.columns.flat().length < GRID_CAP) {
    return {
      columns: attached({ columns: placed({ columns: layout.columns, entry }), grid }),
      used: [...grid.used, entry.kind],
      focus,
      widths: grid.widths,
      splits: grid.splits,
      ...tabs,
    };
  }
  if (grid.tabs !== undefined) {
    const lead = toolsByUseOf({ grid: { ...grid, columns: layout.columns } })[0]?.kind;
    if (lead !== undefined) {
      return joined({ grid, entry, lead });
    }
  }
  const oldest = toolsByUseOf({ grid })[0]?.kind ?? entry.kind;
  return {
    columns: swapped({ columns: grid.columns, kind: oldest, entry }),
    used: [...grid.used.filter((kind) => kind !== oldest), entry.kind],
    focus,
    widths: grid.widths,
    splits: grid.splits,
  };
};

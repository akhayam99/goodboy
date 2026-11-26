import type { DrawerGrid, DrawerGridTabs, OpenDrawer } from './state';

type Params = {
  readonly grid: DrawerGrid;
  readonly kinds: ReadonlyArray<OpenDrawer['kind']>;
};

type TabsParams = Params;

const tabsWithout = ({ grid, kinds }: TabsParams): DrawerGridTabs =>
  Object.fromEntries(
    Object.entries(grid.tabs ?? {}).flatMap(([lead, tab]) => {
      if (tab === undefined) {
        return [];
      }
      const keys = tab.keys.filter((key) => !kinds.some((kind) => kind === key));
      const first = keys[0];
      if (keys.length < 2 || first === undefined) {
        return [];
      }
      const next = kinds.some((kind) => kind === lead) ? first : lead;
      return [[next, { keys, active: keys.includes(tab.active) ? tab.active : first }]];
    }),
  );

export const gridWithout = ({ grid, kinds }: Params): DrawerGrid => {
  if (!grid.columns.some((column) => column.some((panel) => kinds.includes(panel.kind)))) {
    return grid;
  }
  const tabs = tabsWithout({ grid, kinds });
  return {
    columns: grid.columns
      .map((column) => column.filter((panel) => !kinds.includes(panel.kind)))
      .filter((column) => column.length > 0),
    used: grid.used.filter((kind) => !kinds.includes(kind)),
    focus: grid.focus,
    widths: grid.widths,
    splits: grid.splits,
    ...(Object.keys(tabs).length > 0 ? { tabs } : {}),
  };
};

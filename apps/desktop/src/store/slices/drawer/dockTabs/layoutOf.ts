import type { DrawerGrid, OpenDrawer } from '../state';

type Params = {
  readonly columns: DrawerGrid['columns'];
  readonly tabs: DrawerGrid['tabs'];
};

type Layout = {
  readonly columns: DrawerGrid['columns'];
  readonly hidden: ReadonlyArray<OpenDrawer>;
};

export const layoutOf = ({ columns, tabs }: Params): Layout => {
  const members = new Set<string>(
    Object.entries(tabs ?? {}).flatMap(([lead, tab]) =>
      tab === undefined ? [] : tab.keys.filter((key) => key !== lead),
    ),
  );
  return {
    columns: columns
      .map((column) => column.filter((panel) => !members.has(panel.kind)))
      .filter((column) => column.length > 0),
    hidden: columns.flat().filter((panel) => members.has(panel.kind)),
  };
};

import type { DockLayout } from '@goodboy/ui';
import type { DrawerGrid, DrawerGridTabs, OpenDrawer } from '../state';

type Params = {
  readonly grid: DrawerGrid;
  readonly layout: DockLayout;
  readonly active: string | null;
};

export const gridWithLayout = ({ grid, layout, active }: Params): DrawerGrid => {
  const byKind = new Map<string, OpenDrawer>(
    grid.columns.flat().map((panel) => [panel.kind, panel]),
  );
  const columns = layout.columns.map((column) =>
    column.flatMap((key) => {
      const lead = byKind.get(key);
      if (lead === undefined) {
        return [];
      }
      const members = (layout.groups[key] ?? [])
        .filter((member) => member !== key)
        .flatMap((member) => byKind.get(member) ?? []);
      return [lead, ...members];
    }),
  );
  const tabs: DrawerGridTabs = Object.fromEntries(
    Object.entries(layout.groups).flatMap(([lead, keys]) => {
      if (keys.length < 2) {
        return [];
      }
      const shown = [active, grid.tabs?.[lead]?.active].find(
        (key): key is string => key != null && keys.includes(key),
      );
      return [[lead, { keys, active: shown ?? keys[0] ?? lead }]];
    }),
  );
  return {
    columns,
    used: grid.used,
    focus: grid.focus,
    widths: grid.widths,
    splits: grid.splits,
    ...(Object.keys(tabs).length > 0 ? { tabs } : {}),
  };
};

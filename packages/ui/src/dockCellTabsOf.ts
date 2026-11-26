import type { DockTabOption } from './dockTabsContext';
import type { DockGridCell, DockGridSpec } from './dockGridSpec';
import { dockTabOptionsOf } from './dockTabOptionsOf';

type PaneParams = {
  readonly key: string;
  readonly tabs: ReadonlyArray<string>;
};

type Params = {
  readonly spec: DockGridSpec;
  readonly pane: PaneParams;
  readonly focus: string;
  readonly kept?: string;
};

export type DockCellTabsView = {
  readonly keys: ReadonlyArray<string>;
  readonly count: number;
  readonly shown: string;
  readonly isTabbed: boolean;
  readonly isDerived: boolean;
  readonly options: ReadonlyArray<DockTabOption>;
};

type CellsParams = {
  readonly spec: DockGridSpec;
};

const cellsOf = ({ spec }: CellsParams): ReadonlyArray<DockGridCell> =>
  spec.columns.flat().flatMap((cell) => [cell, ...(cell.tabs?.members ?? [])]);

export const cellTabsOf = ({ spec, pane, focus, kept }: Params): DockCellTabsView => {
  const cells = cellsOf({ spec });
  const live = new Set(cells.map((cell) => cell.key));
  const listed = pane.tabs.length > 0 ? pane.tabs : [pane.key];
  const keys = listed.filter((key) => live.has(key) || key === pane.key);
  const chosen = cells.find((cell) => cell.key === pane.key)?.tabs;
  const shown = [focus, chosen?.active, kept].find(
    (key): key is string => key !== undefined && keys.includes(key),
  );
  const resolved = shown ?? pane.key;
  const isDerived = keys.some((key) => chosen?.keys.includes(key) !== true) && keys.length > 1;
  return {
    keys,
    count: keys.length,
    shown: resolved,
    isTabbed: keys.length > 1,
    isDerived,
    options: dockTabOptionsOf({ spec, tabs: keys, shown: resolved }),
  };
};

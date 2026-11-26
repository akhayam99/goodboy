import type { DockMoveTarget, DockMoveUnit } from './dockMoveTarget';
import type { DrawerSizing } from './drawerGeometry';
import type { DockFold } from './useDockFoldReport';

export const DOCK_FOCUS_PAGE = 'page';

export const DOCK_FOCUS_DETAIL = 'detail';

export type DockGridCell = {
  readonly key: string;
  readonly sizing: DrawerSizing;
  readonly savedWidth?: number;
  readonly rowMin?: number;
  readonly hasActivity?: boolean;
  readonly label?: string;
  readonly tabs?: DockCellTabList;
};

export type DockCellTabList = {
  readonly keys: ReadonlyArray<string>;
  readonly active: string;
  readonly members: ReadonlyArray<DockGridCell>;
};

type KeyParams = {
  readonly key: string;
};

export type DockGridResize = KeyParams & {
  readonly width: number;
};

export type DockGridSplit = {
  readonly keys: ReadonlyArray<string>;
  readonly share: number | null;
};

export type DockGridMove = {
  readonly key: string;
  readonly unit: DockMoveUnit;
  readonly target: DockMoveTarget;
};

export type DockGridSpec = {
  readonly columns: ReadonlyArray<ReadonlyArray<DockGridCell>>;
  readonly focus: string;
  readonly splits?: Readonly<Record<string, number>>;
  readonly foldOrder?: ReadonlyArray<string>;
  readonly scope?: string;
  readonly onFocus: (params: KeyParams) => void;
  readonly onTurn: (params: KeyParams) => void;
  readonly onResize?: (params: DockGridResize) => void;
  readonly onSplit?: (params: DockGridSplit) => void;
  readonly onMove?: (params: DockGridMove) => void;
  readonly onFold?: (params: DockFold) => void;
};

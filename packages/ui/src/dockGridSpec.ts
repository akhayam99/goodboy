import type { DrawerSizing } from './drawerGeometry';

export const DOCK_FOCUS_PAGE = 'page';

export const DOCK_FOCUS_DETAIL = 'detail';

export type DockGridCell = {
  readonly key: string;
  readonly sizing: DrawerSizing;
  readonly savedWidth?: number;
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

export type DockGridSpec = {
  readonly columns: ReadonlyArray<ReadonlyArray<DockGridCell>>;
  readonly focus: string;
  readonly splits?: Readonly<Record<string, number>>;
  readonly onFocus: (params: KeyParams) => void;
  readonly onTurn: (params: KeyParams) => void;
  readonly onResize?: (params: DockGridResize) => void;
  readonly onSplit?: (params: DockGridSplit) => void;
};

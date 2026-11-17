import type { ReactNode } from 'react';
import type { DrawerSizing } from './drawerGeometry';

export const DOCK_FOCUS_PAGE = 'page';

export const DOCK_FOCUS_DETAIL = 'detail';

export type DockGridCell = {
  readonly key: string;
  readonly sizing: DrawerSizing;
};

type KeyParams = {
  readonly key: string;
};

export type DockGridSpec = {
  readonly columns: ReadonlyArray<ReadonlyArray<DockGridCell>>;
  readonly focus: string;
  readonly renderCell: (params: KeyParams) => ReactNode;
  readonly onFocus: (params: KeyParams) => void;
  readonly onTurn: (params: KeyParams) => void;
};

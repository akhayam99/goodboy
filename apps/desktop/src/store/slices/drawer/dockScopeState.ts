import type { SessionId } from '@goodboy/types';
import type { DrawerGrid } from './state';

export type DockScope = SessionId | null;

export type DockScopeState = {
  readonly dockScope: DockScope | undefined;
  readonly parkedDockGrids: Readonly<Record<string, DrawerGrid>>;
  readonly lastDockGrid: DrawerGrid | null;
};

export const dockScopeInitialState: DockScopeState = {
  dockScope: undefined,
  parkedDockGrids: {},
  lastDockGrid: null,
};

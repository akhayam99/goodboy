import type { AppState } from '../../types';
import { layoutOf } from './dockTabs/layoutOf';
import { gridWithout } from './gridWithout';
import { panelsOf } from './panelsOf';
import { selectDetailDrawer } from './selectDetailDrawer';
import { EMPTY_DRAWER_GRID, type DrawerFocus, type DrawerGrid, type OpenDrawer } from './state';

type Params = {
  readonly state: Pick<
    AppState,
    'drawer' | 'drawerBack' | 'drawerGrid' | 'currentSessionId' | 'appStudio'
  >;
};

export type ShellPanels = {
  readonly detail: OpenDrawer | null;
  readonly tools: DrawerGrid['columns'];
  readonly layout: DrawerGrid['columns'];
  readonly focus: DrawerFocus;
};

export const shellPanelsOf = ({ state }: Params): ShellPanels => {
  const panels = panelsOf({
    top: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
  });
  const pageKind = state.appStudio?.kind ?? null;
  const shown = gridWithout({
    grid: { ...(state.drawerGrid ?? EMPTY_DRAWER_GRID), columns: panels.tools },
    kinds: panels.tools
      .flat()
      .map((panel) => panel.kind)
      .filter((kind) => kind === pageKind),
  });
  return {
    detail: state.appStudio === null ? selectDetailDrawer({ state }) : null,
    tools: shown.columns,
    layout: layoutOf({ columns: shown.columns, tabs: shown.tabs }).columns,
    focus: panels.focus,
  };
};

import type { AppState } from '../../types';
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
  readonly focus: DrawerFocus;
};

export const shellPanelsOf = ({ state }: Params): ShellPanels => {
  const panels = panelsOf({
    top: state.drawer ?? null,
    back: state.drawerBack ?? null,
    grid: state.drawerGrid ?? EMPTY_DRAWER_GRID,
  });
  const pageKind = state.appStudio?.kind ?? null;
  const tools = panels.tools
    .map((column) => column.filter((panel) => panel.kind !== pageKind))
    .filter((column) => column.length > 0);
  return {
    detail: state.appStudio === null ? selectDetailDrawer({ state }) : null,
    tools,
    focus: panels.focus,
  };
};

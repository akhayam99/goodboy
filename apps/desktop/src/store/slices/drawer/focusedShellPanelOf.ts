import { DOCK_FOCUS_DETAIL } from '@goodboy/ui';
import type { AppState } from '../../types';
import { panelFocusKeyOf } from './panelFocusKeyOf';
import { shellPanelsOf } from './shellPanelsOf';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Pick<
    AppState,
    'drawer' | 'drawerBack' | 'drawerGrid' | 'currentSessionId' | 'appStudio'
  >;
};

export const focusedShellPanelOf = ({ state }: Params): OpenDrawer | null => {
  const panels = shellPanelsOf({ state });
  const key = panelFocusKeyOf({ panels });
  if (key === DOCK_FOCUS_DETAIL) {
    return panels.detail;
  }
  return panels.tools.flat().find((panel) => panel.kind === key) ?? null;
};

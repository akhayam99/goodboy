import type { AppState } from '../../types';
import { panelsOf } from './panelsOf';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'drawerBack' | 'appStudio'>;
};

export const selectDockDrawer = ({ state }: Params): OpenDrawer | null => {
  const dock = panelsOf({ top: state.drawer ?? null, back: state.drawerBack ?? null }).dock;
  if (dock === null || state.appStudio?.kind === dock.kind) {
    return null;
  }
  return dock;
};

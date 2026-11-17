import type { AppState } from '../../types';
import { shellPanelsOf } from './shellPanelsOf';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Pick<
    AppState,
    'drawer' | 'drawerBack' | 'drawerGrid' | 'currentSessionId' | 'appStudio'
  >;
  readonly kind: string;
};

export const selectGridTool = ({ state, kind }: Params): OpenDrawer | null =>
  shellPanelsOf({ state })
    .tools.flat()
    .find((panel) => panel.kind === kind) ?? null;

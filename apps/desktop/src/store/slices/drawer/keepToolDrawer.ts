import type { AppState } from '../../types';
import type { Place } from '../navigation/types';
import { keptTool } from './keptTool';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export const keepToolDrawer = ({ state, place }: Params): OpenDrawer | null =>
  keptTool({ drawer: state.drawer ?? null, place }) ??
  keptTool({ drawer: state.drawerBack ?? null, place });

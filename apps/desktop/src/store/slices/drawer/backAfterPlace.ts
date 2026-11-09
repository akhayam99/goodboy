import type { AppState } from '../../types';
import type { Place } from '../navigation/types';
import { keptTool } from './keptTool';
import { slotKey } from './slotKey';
import type { OpenDrawer } from './state';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'drawerBack'>;
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
};

export const backAfterPlace = ({ state, place, drawer }: Params): OpenDrawer | null => {
  if (drawer === null) {
    return null;
  }
  const candidates = [state.drawer ?? null, state.drawerBack ?? null];
  return (
    candidates
      .map((candidate) => keptTool({ drawer: candidate, place }))
      .find(
        (kept) =>
          kept !== null &&
          kept.sessionId === drawer.sessionId &&
          slotKey({ content: kept }) !== slotKey({ content: drawer }),
      ) ?? null
  );
};

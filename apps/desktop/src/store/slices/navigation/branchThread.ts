import type { OpenDrawer } from '../drawer/state';
import type { Place } from './types';

type Params = {
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
};

export const placeWithThread = ({ place, drawer }: Params): CanonicalPick => {
  if (
    place.at !== 'session' ||
    place.view.target?.kind !== 'branch' ||
    drawer?.kind !== 'conversation' ||
    drawer.sessionId !== place.sessionId
  ) {
    return { place, drawer };
  }
  const { target } = place.view;
  return {
    place: {
      ...place,
      view: {
        ...place.view,
        target: { ...target, tab: 'comments', threadId: drawer.payload.threadId },
      },
    },
    drawer: null,
  };
};

type CanonicalPick = {
  readonly place: Place;
  readonly drawer: OpenDrawer | null;
};

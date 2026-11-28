import { UNSAVED_DRAWER_KINDS } from '../drawer/unsavedDrawerKinds';
import type { Location } from './types';

type Params = {
  readonly location: Location;
};

export const savedLocationOf = ({ location }: Params): Location => {
  const { drawer } = location.focus;
  const place: Location['place'] = location.place.at === 'home' ? { at: 'board' } : location.place;
  const isDrawerUnsaved = drawer !== null && UNSAVED_DRAWER_KINDS.has(drawer.kind);
  if (place === location.place && !isDrawerUnsaved) {
    return location;
  }
  return {
    ...location,
    place,
    focus: isDrawerUnsaved ? { ...location.focus, drawer: null } : location.focus,
  };
};

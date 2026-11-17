import { UNSAVED_DRAWER_KINDS } from '../drawer/unsavedDrawerKinds';
import type { Location } from './types';

type Params = {
  readonly location: Location;
};

export const savedLocationOf = ({ location }: Params): Location => {
  const { drawer } = location.focus;
  if (drawer === null || !UNSAVED_DRAWER_KINDS.has(drawer.kind)) {
    return location;
  }
  return { ...location, focus: { ...location.focus, drawer: null } };
};

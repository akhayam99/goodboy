import type { AppState } from '../../types';
import { parentPlace } from './parentPlace';
import { placeTitleOf } from './placeTitleOf';
import type { Place } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

export type Back = {
  readonly label: string;
  readonly to: Place;
};

export const backOf = ({ state, place }: Params): Back | null => {
  const parent = parentPlace({ state, place });
  if (parent === null || parent.at !== 'session') {
    return null;
  }
  const { title, isName } = placeTitleOf({ state, place: parent });
  return { label: `Back to ${isName ? title : title.toLowerCase()}`, to: parent };
};

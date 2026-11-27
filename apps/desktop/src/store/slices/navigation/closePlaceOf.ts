import { HOME_PLACE } from './place';
import type { Place } from './types';

type Params = {
  readonly place: Place;
};

export const closePlaceOf = ({ place }: Params): Place | null =>
  place.at === 'session' ? HOME_PLACE : null;

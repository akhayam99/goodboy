import type { AppState } from '../../types';
import { currentStack } from './currentStack';
import { BOARD_PLACE } from './place';
import type { Place } from './types';

type Params = {
  readonly state: AppState;
};

export const placeBeforeDraft = ({ state }: Params): Place => {
  const stack = currentStack(state);
  const previous = stack.entries[stack.index - 1];
  if (previous === undefined || previous.place.at === 'session-draft') {
    return BOARD_PLACE;
  }
  return previous.place;
};

import { amendFocus } from './amendFocus';
import { back } from './back';
import { forward } from './forward';
import { navigate } from './navigate';
import { amendStudio, closeStudio, openStudio } from './studioMoves';
import { up } from './up';
import type { GetFn, SetFn } from './types';

export const createNavigationSlice = (set: SetFn, get: GetFn) => {
  return {
    navigate: navigate(set, get),
    back: back(set, get),
    forward: forward(set, get),
    up: up(set, get),
    amendFocus: amendFocus(set, get),
    openStudio: openStudio(set, get),
    amendStudio: amendStudio(set, get),
    closeStudio: closeStudio(set, get),
  };
};

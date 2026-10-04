import { amendFocus } from './amendFocus';
import { back } from './back';
import { forward } from './forward';
import { goToHistory } from './goToHistory';
import { navigate } from './navigate';
import { restoreLocation } from './restoreLocation';
import { amendStudio, closeStudio, openStudio, switchStudio } from './studioMoves';
import { up } from './up';
import type { SliceDeps } from '../../slice-types';

export const createNavigationSlice = ({ set, get }: SliceDeps) => {
  return {
    navigate: navigate(set, get),
    back: back(set, get),
    forward: forward(set, get),
    goToHistory: goToHistory(set, get),
    up: up(set, get),
    amendFocus: amendFocus(set, get),
    openStudio: openStudio(set, get),
    amendStudio: amendStudio(set, get),
    switchStudio: switchStudio(set, get),
    closeStudio: closeStudio(set, get),
    restoreLocation: restoreLocation(set, get),
  };
};

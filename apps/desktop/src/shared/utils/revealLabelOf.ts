import { currentPlatform } from '../platform';
import { NAMES } from './names';

type Params = {
  readonly target?: string;
};

export const revealLabelOf = ({ target }: Params = {}): string => {
  const isMac = currentPlatform() === 'darwin';
  if (target === undefined) {
    return isMac ? NAMES.showInFinder : NAMES.showInFolder;
  }
  return `Show ${target} in ${isMac ? 'Finder' : 'its folder'}`;
};

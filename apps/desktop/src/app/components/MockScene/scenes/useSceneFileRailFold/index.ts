import { useEffect, useState } from 'react';
import { studioRailFoldKey } from '@goodboy/ui';
import { CHANGES_RAIL_SURFACE } from '../../../../../features/diff/changesRailSurface';

type Params = {
  readonly isFolded: boolean;
};

const FOLD_KEY = studioRailFoldKey({ surface: CHANGES_RAIL_SURFACE });

const writeFold = ({ isFolded }: Params): boolean => {
  try {
    localStorage.setItem(FOLD_KEY, isFolded ? '1' : '0');
  } catch {
    return isFolded;
  }
  return isFolded;
};

const clearFold = (): void => {
  try {
    localStorage.removeItem(FOLD_KEY);
  } catch {
    return;
  }
};

export const useSceneFileRailFold = ({ isFolded }: Params): void => {
  useState(() => writeFold({ isFolded }));
  useEffect(() => {
    writeFold({ isFolded });
    return clearFold;
  }, [isFolded]);
};

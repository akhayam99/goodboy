import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';

type Params = {
  readonly isFolded: boolean;
};

const writeFold = ({ isFolded }: Params): boolean => {
  try {
    localStorage.setItem(STORAGE_KEYS.diffFileRailFolded, isFolded ? '1' : '0');
  } catch {
    return isFolded;
  }
  return isFolded;
};

const clearFold = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.diffFileRailFolded);
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

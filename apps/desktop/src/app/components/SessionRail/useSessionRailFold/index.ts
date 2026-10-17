import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';

type Params = {
  readonly isNarrow: boolean;
};

export type SessionRailFold = {
  readonly isFolded: boolean;
  readonly toggle: () => void;
};

const foldedPref = persistedPref<boolean>({
  key: STORAGE_KEYS.sessionRailCollapsed,
  parse: (raw) => raw === '1',
  serialize: (isFolded) => (isFolded ? '1' : '0'),
  fallback: false,
});

export const useSessionRailFold = ({ isNarrow }: Params): SessionRailFold => {
  const [isFoldPicked, setIsFoldPicked] = useState(foldedPref.read);
  const [isOpenedNarrow, setIsOpenedNarrow] = useState(false);
  const isFolded = isFoldPicked || (isNarrow && !isOpenedNarrow);

  useEffect(() => {
    if (isNarrow) {
      return;
    }
    setIsOpenedNarrow(false);
  }, [isNarrow]);

  const toggle = useCallback(() => {
    if (isNarrow && !isFolded) {
      setIsOpenedNarrow(false);
      return;
    }
    if (isNarrow) {
      foldedPref.write(false);
      setIsFoldPicked(false);
      setIsOpenedNarrow(true);
      return;
    }
    const isNowFolded = !isFoldPicked;
    foldedPref.write(isNowFolded);
    setIsFoldPicked(isNowFolded);
  }, [isFoldPicked, isFolded, isNarrow]);

  return { isFolded, toggle };
};

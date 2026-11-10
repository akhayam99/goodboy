import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';

type Params = {
  readonly isNarrow: boolean;
  readonly isDrawerOpen?: boolean;
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

export const useSessionRailFold = ({
  isNarrow,
  isDrawerOpen = isNarrow,
}: Params): SessionRailFold => {
  const [isFoldPicked, setIsFoldPicked] = useState(foldedPref.read);
  const [isOpenedNarrow, setIsOpenedNarrow] = useState(false);
  const isFolded = isNarrow ? !isOpenedNarrow : isFoldPicked;

  useEffect(() => {
    if (isDrawerOpen) {
      return;
    }
    setIsOpenedNarrow(false);
  }, [isDrawerOpen]);

  const toggle = useCallback(() => {
    if (isNarrow) {
      setIsOpenedNarrow(isFolded);
      return;
    }
    const isNowFolded = !isFolded;
    foldedPref.write(isNowFolded);
    setIsFoldPicked(isNowFolded);
    setIsOpenedNarrow(false);
  }, [isFolded, isNarrow]);

  return { isFolded, toggle };
};

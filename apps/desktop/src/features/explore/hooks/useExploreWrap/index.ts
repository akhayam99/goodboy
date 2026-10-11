import { useCallback, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';

const wrapPref = persistedPref<boolean>({
  key: STORAGE_KEYS.exploreWrap,
  fallback: false,
  parse: (raw) => {
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return undefined;
  },
});

type Result = {
  readonly isWrapped: boolean;
  readonly toggle: () => void;
};

export const useExploreWrap = (): Result => {
  const [isWrapped, setIsWrapped] = useState<boolean>(() => wrapPref.read());
  const toggle = useCallback(() => {
    setIsWrapped((isCurrentlyWrapped) => {
      wrapPref.write(!isCurrentlyWrapped);
      return !isCurrentlyWrapped;
    });
  }, []);
  return { isWrapped, toggle };
};

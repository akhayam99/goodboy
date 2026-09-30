import { useCallback, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../shared/lib/storage-keys';

type SetWrap = (next: boolean) => void;

const wrapPref = persistedPref<boolean>({
  key: STORAGE_KEYS.diffWrap,
  parse: (raw) => raw !== '0',
  serialize: (wrap) => (wrap ? '1' : '0'),
  fallback: true,
});

export const useDiffWrap = (): readonly [boolean, SetWrap] => {
  const [wrap, setWrapState] = useState(wrapPref.read);
  const setWrap = useCallback((next: boolean) => {
    setWrapState(next);
    wrapPref.write(next);
  }, []);
  return [wrap, setWrap] as const;
};

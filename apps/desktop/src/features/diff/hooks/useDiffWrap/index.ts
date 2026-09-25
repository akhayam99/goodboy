import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';

type SetWrap = (next: boolean) => void;

const readWrap = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.diffWrap) !== '0';
  } catch {
    return true;
  }
};

export const useDiffWrap = (): readonly [boolean, SetWrap] => {
  const [wrap, setWrapState] = useState(readWrap);
  const setWrap = useCallback((next: boolean) => {
    setWrapState(next);
    try {
      localStorage.setItem(STORAGE_KEYS.diffWrap, next ? '1' : '0');
    } catch {
      return;
    }
  }, []);
  return [wrap, setWrap] as const;
};

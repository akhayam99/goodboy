import { useCallback, useState } from 'react';
import { type DiffLayoutMode } from '@goodboy/ui';
import { STORAGE_KEYS } from '../../lib/storage-keys';

type SetLayoutMode = (mode: DiffLayoutMode) => void;

const readLayoutMode = (): DiffLayoutMode => {
  if (typeof localStorage === 'undefined') {
    return 'unified';
  }
  return localStorage.getItem(STORAGE_KEYS.diffLayoutMode) === 'split' ? 'split' : 'unified';
};

export const useDiffLayoutMode = (): readonly [DiffLayoutMode, SetLayoutMode] => {
  const [mode, setModeState] = useState(readLayoutMode);
  const setMode = useCallback((nextMode: DiffLayoutMode) => {
    setModeState(nextMode);
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEYS.diffLayoutMode, nextMode);
  }, []);
  return [mode, setMode] as const;
};

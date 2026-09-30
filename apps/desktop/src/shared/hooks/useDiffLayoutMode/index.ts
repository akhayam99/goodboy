import { useCallback, useState } from 'react';
import { type DiffLayoutMode } from '@goodboy/ui';
import { STORAGE_KEYS, persistedPref } from '../../lib/storage-keys';

type SetLayoutMode = (mode: DiffLayoutMode) => void;

const layoutPref = persistedPref<DiffLayoutMode>({
  key: STORAGE_KEYS.diffLayoutMode,
  parse: (raw) => (raw === 'split' ? 'split' : 'unified'),
  serialize: (mode) => mode,
  fallback: 'unified',
});

export const useDiffLayoutMode = (): readonly [DiffLayoutMode, SetLayoutMode] => {
  const [mode, setModeState] = useState(layoutPref.read);
  const setMode = useCallback((nextMode: DiffLayoutMode) => {
    setModeState(nextMode);
    layoutPref.write(nextMode);
  }, []);
  return [mode, setMode] as const;
};

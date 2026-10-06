import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';

export const useSplitDiffPreference = (): boolean => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.diffLayoutMode, 'split');
    } catch {
      return;
    } finally {
      setIsReady(true);
    }
  }, []);
  return isReady;
};

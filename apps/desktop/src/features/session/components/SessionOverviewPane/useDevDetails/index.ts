import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../../../shared/lib/storage-keys';
import { storedText } from '../../../../../shared/lib/storedText';

const HIDDEN = 'hidden';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type KeyParams = {
  readonly key: string;
};

const isShownAt = ({ key }: KeyParams): boolean => storedText.read({ key }) !== HIDDEN;

export const useDevDetails = ({ workspaceId }: Params) => {
  const key = `${STORAGE_PREFIXES.overviewDevDetails}${workspaceId}`;
  const [isShown, setIsShown] = useState(() => isShownAt({ key }));
  useEffect(() => {
    setIsShown(isShownAt({ key }));
    const sync = ({ key: changed }: StorageEvent) => {
      if (changed === key || changed === null) {
        setIsShown(isShownAt({ key }));
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);
  const toggle = useCallback(() => {
    const isNowShown = !isShownAt({ key });
    storedText.write({ key, text: isNowShown ? '' : HIDDEN });
    setIsShown(isNowShown);
  }, [key]);
  return { isShown, toggle };
};

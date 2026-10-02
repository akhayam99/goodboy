import { useSyncExternalStore } from 'react';

const COARSE_QUERY = '(hover: none) and (pointer: coarse)';

const subscribe = (notify: () => void) => {
  const media = window.matchMedia(COARSE_QUERY);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

const readSnapshot = () => window.matchMedia(COARSE_QUERY).matches;

const readServerSnapshot = () => false;

export const useIsCoarse = (): boolean =>
  useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);

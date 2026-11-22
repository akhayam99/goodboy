import { useCallback, useSyncExternalStore } from 'react';
import { liveMounts, type LiveMountsSnapshot } from '../../liveMounts';

export const useLiveMounts = (): LiveMountsSnapshot => {
  const subscribe = useCallback((listener: () => void) => liveMounts.subscribe({ listener }), []);
  return useSyncExternalStore(subscribe, liveMounts.snapshot);
};

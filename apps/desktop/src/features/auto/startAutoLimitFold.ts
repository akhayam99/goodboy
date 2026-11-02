import { useAppStore } from '../../store';
import { foldAutoLimitsAtBoot } from './foldAutoLimitsAtBoot';

export const startAutoLimitFold = (): (() => void) => {
  let isDone = false;
  const foldOnceHydrated = (): void => {
    if (isDone || !useAppStore.getState().hydrated) {
      return;
    }
    isDone = true;
    void foldAutoLimitsAtBoot();
  };
  const unsubscribe = useAppStore.subscribe(foldOnceHydrated);
  foldOnceHydrated();
  return unsubscribe;
};

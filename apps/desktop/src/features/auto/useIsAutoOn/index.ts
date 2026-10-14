import { isAutoStartEnabled } from '../isAutoStartEnabled';
import { useAutoExperimentValue } from '../useAutoExperimentValue';
import { useIsAutoReleased } from '../useIsAutoReleased';

export const useIsAutoOn = (): boolean => {
  const settings = useAutoExperimentValue();
  const isReleased = useIsAutoReleased();
  return isAutoStartEnabled({ settings, isReleased });
};

import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import {
  autoLimitContext,
  type AutoLimitContext,
} from '../../../store/slices/providerLimits/autoLimitContext';

export const useAutoLimitContext = (): AutoLimitContext | null => {
  const providers = useAppStore((state) => state.providers);
  const providerLimits = useAppStore((state) => state.providerLimits);
  return useMemo(
    () => autoLimitContext({ state: { providers, providerLimits } }),
    [providerLimits, providers],
  );
};

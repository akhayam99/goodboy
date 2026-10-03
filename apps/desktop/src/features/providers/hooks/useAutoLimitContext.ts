import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { SETTING_HIDDEN_MODELS } from '../../settings/settings';
import {
  autoLimitContext,
  type AutoLimitContext,
} from '../../../store/slices/providerLimits/autoLimitContext';

export const useAutoLimitContext = (): AutoLimitContext | null => {
  const providers = useAppStore((state) => state.providers);
  const providerLimits = useAppStore((state) => state.providerLimits);
  const hiddenRaw = useAppStore((state) => state.settings?.[SETTING_HIDDEN_MODELS] ?? null);
  const policy = useAppStore((state) =>
    state.currentWorkspaceId == null
      ? null
      : (state.workspaceOverrides?.[state.currentWorkspaceId]?.providerPool ?? null),
  );
  return useMemo(
    () =>
      autoLimitContext({
        state: {
          providers,
          providerLimits,
          settings: hiddenRaw === null ? {} : { [SETTING_HIDDEN_MODELS]: hiddenRaw },
        },
        policy,
      }),
    [hiddenRaw, policy, providerLimits, providers],
  );
};

import { useMemo } from 'react';
import type { AutoContext } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectResolvedSettings } from '../../../store/slices/overrides/selectResolvedSettings';
import { autoLimitContext } from '../../../store/slices/providerLimits/autoLimitContext';
import { kindAutoContext } from '../../../features/session/kindAutoContext';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';

type Params = {
  readonly sessionId: SessionId | null;
};

export const useRoutingScope = ({ sessionId }: Params): AutoContext | null => {
  const hasSettings = useAppStore(
    (state) => sessionId !== null && selectResolvedSettings({ state, sessionId }) !== null,
  );
  const defaultProvider = useAppStore((state) =>
    sessionId === null
      ? null
      : (selectResolvedSettings({ state, sessionId })?.defaultProviderId ?? null),
  );
  const policy = useAppStore((state) =>
    sessionId === null
      ? null
      : (selectResolvedSettings({ state, sessionId })?.providerPool ?? null),
  );
  const providers = useAppStore((state) => state.providers);
  const providerLimits = useAppStore((state) => state.providerLimits);
  const hiddenRaw = useAppStore((state) => state.settings?.[SETTING_HIDDEN_MODELS] ?? null);
  const workspacePolicy = useAppStore((state) =>
    state.currentWorkspaceId == null
      ? null
      : (state.workspaceOverrides?.[state.currentWorkspaceId]?.providerPool ?? null),
  );
  return useMemo(
    () =>
      kindAutoContext({
        defaultProvider,
        limitContext: autoLimitContext({
          state: {
            providers,
            providerLimits,
            settings: hiddenRaw === null ? {} : { [SETTING_HIDDEN_MODELS]: hiddenRaw },
          },
          policy: workspacePolicy,
        }),
        ...(hasSettings && { policy }),
      }),
    [defaultProvider, hasSettings, hiddenRaw, policy, providerLimits, providers, workspacePolicy],
  );
};

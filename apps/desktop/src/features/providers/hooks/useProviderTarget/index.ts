import { useCallback, useMemo, useState } from 'react';
import { PROVIDER_CONNECT_CAPABILITIES, isApiProvider } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import type { ProviderActionTarget } from '../../../actions/types';
import { canTestConnection } from '../../components/ProviderStudio/ProviderPage/AccountGroup/ConnectionTest/canTestConnection';
import type { ProviderDisplayInfo } from '../../providers';

type Params = {
  readonly info: ProviderDisplayInfo;
  readonly isReady: boolean;
};

type ProviderTarget = {
  readonly target: ProviderActionTarget;
  readonly isChecking: boolean;
  readonly isHistoryOpen: boolean;
  readonly refresh: () => Promise<void>;
  readonly closeHistory: () => void;
};

export const useProviderTarget = ({ info, isReady }: Params): ProviderTarget => {
  const id = info.id;
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const connectProvider = useAppStore((state) => state.connectProvider);
  const logoutProvider = useAppStore((state) => state.logoutProvider);
  const testProviderConnection = useAppStore((state) => state.testProviderConnection);
  const isTesting = useAppStore((state) => state.providerConnectionTests[id]?.isTesting === true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const isApi = isApiProvider({ id });
  const capability = PROVIDER_CONNECT_CAPABILITIES[id];

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProviders({ isFresh: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProviders]);

  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const isChecking = isRefreshing || isTesting;

  const target = useMemo(
    (): ProviderActionTarget => ({
      kind: 'provider',
      facts: {
        label: info.label,
        cliPath: info.binary,
        isChecking,
        canReauth: isReady && !isApi && capability.tier !== 'manual',
        willSignOutOnReauth: capability.reauthSignsOut === true,
        canDisconnect: isReady && !isApi,
        onCheck: async () => {
          await refresh();
          if (canTestConnection({ providerId: id })) {
            await testProviderConnection({ providerId: id });
          }
        },
        onReauth: async () => {
          await connectProvider(id);
        },
        onShowHistory: isApi ? null : () => setIsHistoryOpen((isOpen) => !isOpen),
        onDisconnect: async () => {
          await logoutProvider(id);
        },
      },
    }),
    [
      info.label,
      info.binary,
      id,
      isChecking,
      isReady,
      isApi,
      capability.tier,
      capability.reauthSignsOut,
      refresh,
      testProviderConnection,
      connectProvider,
      logoutProvider,
    ],
  );

  return { target, isChecking, isHistoryOpen, refresh, closeHistory };
};

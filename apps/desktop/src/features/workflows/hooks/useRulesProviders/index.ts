import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE, readHeadroom } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { policyRows } from '../../../providers/policy/policyRows';
import { rulesProviderRooms } from '../../rulesHeadroom';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly isSpreadOn: boolean;
};

export const useRulesProviders = ({ workspaceId, isSpreadOn }: Params) => {
  const policy = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.providerPool ?? null,
  );
  const savedDefault = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.defaultProviderId ?? null,
  );
  const connected = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const limits = useAppStore((state) => state.providerLimits);
  const nowMs = useNow(60_000, isSpreadOn);
  const defaultProvider = savedDefault ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  const rows = useMemo(
    () => policyRows({ policy, defaultProvider, connected, limits, nowMs }),
    [connected, defaultProvider, limits, nowMs, policy],
  );
  return useMemo(
    () =>
      rulesProviderRooms({
        rows,
        headroom: readHeadroom({ limits, policy, nowMs }).headroom,
        limits,
      }),
    [limits, nowMs, policy, rows],
  );
};

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { policyRows } from '../../../providers/policy/policyRows';
import { policySummary } from '../../../providers/policy/policySummary';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const usePolicySummary = ({ workspaceId }: Params): string => {
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
  const nowMs = useNow(60_000);
  const defaultProvider = savedDefault ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  return useMemo(
    () =>
      policySummary({ rows: policyRows({ policy, defaultProvider, connected, limits, nowMs }) })
        .text,
    [connected, defaultProvider, limits, nowMs, policy],
  );
};

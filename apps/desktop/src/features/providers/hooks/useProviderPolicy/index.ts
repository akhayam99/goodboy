import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import type { ProviderId, ProviderPolicyState, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import {
  basePolicy,
  moveRow,
  policyFromRows,
  policyRows,
  type PolicyRow,
} from '../../policy/policyRows';
import { policySummary, type PolicySummary } from '../../policy/policySummary';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type MarkKey = 'payAsYouGo' | 'keepAfterLimit';

type WriteParams = {
  readonly next: ReadonlyArray<PolicyRow>;
};

type MoveParams = {
  readonly id: ProviderId;
  readonly to: number;
};

type StateParams = {
  readonly id: ProviderId;
  readonly state: ProviderPolicyState;
};

type MarkParams = {
  readonly id: ProviderId;
  readonly mark: MarkKey;
};

export type ProviderPolicyModel = Readonly<{
  rows: ReadonlyArray<PolicyRow>;
  summary: PolicySummary;
  isCustom: boolean;
  nowMs: number;
  moveTo: (params: MoveParams) => void;
  setState: (params: StateParams) => void;
  toggleMark: (params: MarkParams) => void;
  reset: () => void;
}>;

export const useProviderPolicy = ({ workspaceId }: Params): ProviderPolicyModel => {
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
  const setProviderPolicy = useAppStore((state) => state.setProviderPolicy);
  const nowMs = useNow(60_000);
  const defaultProvider = savedDefault ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;

  const rows = useMemo(
    () => policyRows({ policy, defaultProvider, connected, limits, nowMs }),
    [connected, defaultProvider, limits, nowMs, policy],
  );
  const summary = useMemo(() => policySummary({ rows }), [rows]);

  const write = ({ next }: WriteParams) => {
    const base = basePolicy({ policy, defaultProvider, connected });
    void setProviderPolicy({ workspaceId, policy: policyFromRows({ rows: next, base }) });
  };

  const moveTo = ({ id, to }: MoveParams) => {
    const from = rows.findIndex((row) => row.id === id);
    const next = moveRow({ rows, from, to });
    if (next === rows) {
      return;
    }
    write({ next: next.map((row) => (row.id === id ? { ...row, isNew: false } : row)) });
  };

  const setState = ({ id, state }: StateParams) => {
    write({ next: rows.map((row) => (row.id === id ? { ...row, state, isNew: false } : row)) });
  };

  const toggleMark = ({ id, mark }: MarkParams) => {
    write({ next: rows.map((row) => (row.id === id ? { ...row, [mark]: !row[mark] } : row)) });
  };

  const reset = () => {
    void setProviderPolicy({ workspaceId, policy: null });
  };

  return { rows, summary, isCustom: policy !== null, nowMs, moveTo, setState, toggleMark, reset };
};

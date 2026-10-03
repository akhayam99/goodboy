import { providersAtLimit } from '@goodboy/core';
import type { ProviderId, ProviderPolicy } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Partial<
    Pick<AppStore, 'providerLimits' | 'workspaceOverrides' | 'currentWorkspaceId'>
  >;
  readonly nowMs?: number;
};

export type WorkspacePolicyAvailability = {
  readonly policy: ProviderPolicy | null;
  readonly atLimit: ReadonlyArray<ProviderId>;
};

export const workspacePolicyAvailability = ({
  state,
  nowMs = Date.now(),
}: Params): WorkspacePolicyAvailability => {
  const workspaceId = state.currentWorkspaceId ?? null;
  const policy =
    workspaceId === null ? null : (state.workspaceOverrides?.[workspaceId]?.providerPool ?? null);
  if (policy === null) {
    return { policy: null, atLimit: [] };
  }
  return { policy, atLimit: providersAtLimit({ limits: state.providerLimits ?? {}, nowMs }) };
};

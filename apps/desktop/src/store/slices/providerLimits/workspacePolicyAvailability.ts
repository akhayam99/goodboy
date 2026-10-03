import { providersAtLimit } from '@goodboy/core';
import type { ProviderId, ProviderPolicy, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly state: Partial<
    Pick<AppStore, 'providerLimits' | 'workspaceOverrides' | 'currentWorkspaceId' | 'sessions'>
  >;
  readonly sessionId: SessionId | null;
  readonly nowMs?: number;
};

export type WorkspacePolicyAvailability = {
  readonly policy: ProviderPolicy | null;
  readonly atLimit: ReadonlyArray<ProviderId>;
};

export const workspacePolicyAvailability = ({
  state,
  sessionId,
  nowMs = Date.now(),
}: Params): WorkspacePolicyAvailability => {
  const session = sessionId === null ? undefined : sessionById(state.sessions, sessionId);
  const workspaceId = session?.workspaceId ?? state.currentWorkspaceId ?? null;
  const policy =
    workspaceId === null ? null : (state.workspaceOverrides?.[workspaceId]?.providerPool ?? null);
  if (policy === null) {
    return { policy: null, atLimit: [] };
  }
  return { policy, atLimit: providersAtLimit({ limits: state.providerLimits ?? {}, nowMs }) };
};

import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import type { AgentRole, ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { suggestedRouting, type SuggestedRouting } from '../../suggestedRouting';

type Params = {
  readonly sessionId: SessionId;
  readonly role: AgentRole;
};

const EMPTY_POOL: ReadonlyArray<ProviderId> = [];

export const useSuggestedRouting = ({ sessionId, role }: Params): SuggestedRouting => {
  const roleModels = useSessionRoleModels({ sessionId });
  const defaultProvider = useAppStore(
    (state) =>
      selectResolvedSettings({ state, sessionId })?.defaultProviderId ??
      DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
  );
  const providerPool = useAppStore(
    useShallow((state) => selectResolvedSettings({ state, sessionId })?.providerPool ?? EMPTY_POOL),
  );
  const connected = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const cliVersions = useAppStore(
    useShallow((state) =>
      Object.fromEntries(
        state.providers.map((provider) => [provider.id, provider.version ?? null]),
      ),
    ),
  );
  const workspaceName = useAppStore((state) => {
    const workspaceId = state.sessions?.find((session) => session.id === sessionId)?.workspaceId;
    return state.workspaces?.find((workspace) => workspace.id === workspaceId)?.name ?? null;
  });
  const pool = providerPool.length === 0 ? connected : providerPool;
  const fallbackOrder = [
    defaultProvider,
    ...connected.filter((id) => id !== defaultProvider && pool.includes(id)),
  ];
  return suggestedRouting({
    role,
    roleModels,
    auto: {
      defaultProvider,
      ...(connected.length > 0 && { connected }),
      fallbackOrder,
      cliVersions,
    },
    workspaceName,
  });
};

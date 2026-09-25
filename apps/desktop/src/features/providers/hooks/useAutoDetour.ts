import { resolveAuto } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAutoLimitContext } from './useAutoLimitContext';

type Params = {
  readonly providerId: ProviderId;
};

export const useAutoDetour = ({ providerId }: Params): ProviderId | null => {
  const limitContext = useAutoLimitContext();
  const defaultProvider = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.currentWorkspaceId)?.overrides
        .defaultProviderId ?? null,
  );
  if (limitContext === null || !limitContext.atLimit.includes(providerId)) {
    return null;
  }
  const pick = resolveAuto({
    slot: { kind: 'role', id: 'implementer' },
    defaultProvider: defaultProvider ?? providerId,
    connected: limitContext.connected,
    atLimit: limitContext.atLimit,
  });
  if (pick == null || !(pick.skippedAtLimit ?? []).includes(providerId)) {
    return null;
  }
  return pick.provider;
};

import { resolveSlot } from '@goodboy/core';
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
  const resolution = resolveSlot({
    slot: { kind: 'role', id: 'implementer' },
    context: {
      defaultProvider: defaultProvider ?? providerId,
      connected: limitContext.connected,
      atLimit: limitContext.atLimit,
    },
  });
  const isDetour = resolution.skipped.some(
    (skip) => skip.provider === providerId && skip.reason === 'at-limit',
  );
  return isDetour ? resolution.provider : null;
};

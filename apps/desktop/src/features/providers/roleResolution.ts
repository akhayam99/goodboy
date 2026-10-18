import { getDefaultTurnModel, resolveSlot, type Resolution } from '@goodboy/core';
import type { AgentRole, ProviderId, RoleModelPreferences, StepSize } from '@goodboy/types';

type RoleParams = {
  readonly role: AgentRole;
  readonly roleModels?: RoleModelPreferences | null;
};

type OnProviderParams = RoleParams & {
  readonly provider: ProviderId;
  readonly size?: StepSize | null;
};

export const roleResolutionOf = ({ role, roleModels = null }: RoleParams): Resolution =>
  resolveSlot({ slot: { kind: 'role', id: role }, layers: { workspace: { roleModels } } });

export const modelOnProvider = ({
  role,
  roleModels = null,
  provider,
  size = null,
}: OnProviderParams): string => {
  const resolution = resolveSlot({
    slot: { kind: 'role', id: role },
    layers: { workspace: { roleModels } },
    context: { defaultProvider: provider, connected: [provider] },
    size,
  });
  return resolution.provider === provider
    ? resolution.model
    : getDefaultTurnModel({ id: provider });
};

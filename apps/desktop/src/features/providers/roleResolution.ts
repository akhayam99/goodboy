import { getDefaultTurnModel, resolveSlot, type Resolution } from '@goodboy/core';
import type { AgentRole, ProviderId, RoleModelPreferences } from '@goodboy/types';

type RoleParams = {
  readonly role: AgentRole;
  readonly roleModels?: RoleModelPreferences | null;
};

type OnProviderParams = RoleParams & {
  readonly provider: ProviderId;
};

export const roleResolutionOf = ({ role, roleModels = null }: RoleParams): Resolution =>
  resolveSlot({ slot: { kind: 'role', id: role }, layers: { workspace: { roleModels } } });

export const modelOnProvider = ({
  role,
  roleModels = null,
  provider,
}: OnProviderParams): string => {
  const resolution = resolveSlot({
    slot: { kind: 'role', id: role },
    layers: { workspace: { roleModels } },
    context: { defaultProvider: provider, connected: [provider] },
  });
  return resolution.provider === provider
    ? resolution.model
    : getDefaultTurnModel({ id: provider });
};

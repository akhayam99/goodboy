import { DEFAULT_GROUPS } from '@goodboy/core/settings';
import type { AgentRole, ProviderId, ProviderPolicy, WorkspaceId } from '@goodboy/types';
import { resolutionOf } from '../../../../../store/runtime/models/selectResolution';
import { useModelScope } from '../../../hooks/useModelScope';
import { PinnedOffLine } from './PinnedOffLine';
import { isPinUnrunnable } from './resolutionNote';

type ClearParams = {
  readonly roles: ReadonlyArray<AgentRole>;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly policy: ProviderPolicy | null;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly isDisabled: boolean;
  readonly onClear: (params: ClearParams) => Promise<void>;
};

const SHOWN_ROLES = DEFAULT_GROUPS.agents.flatMap((group) => group.members);

export const RolePinsOffLine = ({
  workspaceId,
  policy,
  connectedProviderIds,
  isDisabled,
  onClear,
}: Props) => {
  const scope = useModelScope({ workspaceId });
  const unrunnableRoles = SHOWN_ROLES.filter((role) =>
    isPinUnrunnable({ resolution: resolutionOf({ scope, slot: { kind: 'role', id: role } }) }),
  );
  const onProviderIds = connectedProviderIds.filter(
    (id) => policy == null || policy.some((entry) => entry.id === id && entry.state === 'on'),
  );
  return (
    <PinnedOffLine
      count={unrunnableRoles.length}
      total={SHOWN_ROLES.length}
      onProviderIds={onProviderIds}
      isDisabled={isDisabled}
      onConfirm={() => onClear({ roles: unrunnableRoles })}
    />
  );
};

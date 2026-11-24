import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { ROLE_REGISTRY } from '@goodboy/core/roles';
import { DEFAULT_GROUPS } from '@goodboy/core/settings';
import { Band } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { mergeWorkspaceOverrides } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { ROLE_LABEL } from '../../../session/agent-kind';
import {
  DefaultsGroup,
  RoleRow,
  RunsSection,
  useDefaultsPersistence,
  useHasPlanRuns,
} from '../../../providers/defaultsPanelSurfaces';
import { OlderPlanRunsBand } from './OlderPlanRunsBand';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const EveryRunModels = ({ workspaceId }: Props) => {
  const saved = useAppStore((state) => state.workspaceOverrides?.[workspaceId]);
  const overrides = useMemo(() => mergeWorkspaceOverrides({ base: saved, patch: {} }), [saved]);
  const connectedProviderIds = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const hasPlanRuns = useHasPlanRuns({ workspaceId });
  const {
    busy: isBusy,
    error,
    persistRoleModel,
    persistTaskModel,
  } = useDefaultsPersistence({
    workspaceId,
  });

  return (
    <>
      <RunsSection
        workspaceId={workspaceId}
        overrides={overrides}
        connectedProviderIds={connectedProviderIds}
        isDisabled={isBusy}
        hasPlanRuns={false}
        onRoleChange={persistRoleModel}
        onTaskChange={persistTaskModel}
      />
      <Band label="Roles" ariaLabel="Roles" headingLevel={2}>
        {DEFAULT_GROUPS.agents.map((group) => (
          <DefaultsGroup key={group.id} label={group.label}>
            {group.members.map((role) => (
              <RoleRow
                key={role}
                workspaceId={workspaceId}
                role={role}
                label={ROLE_LABEL[role]}
                help={ROLE_REGISTRY[role].summary}
                preference={overrides.roleModels?.[role] ?? null}
                isParallelOn={overrides.parallelAgents === true}
                connectedProviderIds={connectedProviderIds}
                disabled={isBusy}
                onChange={(preference) => persistRoleModel({ role, preference })}
              />
            ))}
          </DefaultsGroup>
        ))}
      </Band>
      {hasPlanRuns ? (
        <OlderPlanRunsBand
          workspaceId={workspaceId}
          preference={overrides.taskModels?.workflow_orchestrator ?? null}
          connectedProviderIds={connectedProviderIds}
          isDisabled={isBusy}
          onChange={(preference) => persistTaskModel({ task: 'workflow_orchestrator', preference })}
        />
      ) : null}
      {error != null ? <p className="text-meta text-danger">{error}</p> : null}
    </>
  );
};

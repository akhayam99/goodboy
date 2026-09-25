import { useState } from 'react';
import type { AgentRole, OverrideSettings, ProviderId, WorkspaceId } from '@goodboy/types';
import {
  ROLE_REGISTRY,
  SELECTABLE_AGENT_ROLES,
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  TASKS,
} from '@goodboy/core';
import { EmptyState, FieldRow, SectionHeader, SegmentedTabs } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { ProviderChip } from '../../ProviderChip';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { useAppStore } from '../../../../../store';
import { RoleModelRow } from './RoleModelRow';
import { TaskModelRow } from './TaskModelRow';
import { useDefaultsPersistence } from './useDefaultsPersistence';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { ProviderPicker } from '../../../../../shared/components/RoutingPicker/ProviderPicker';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type ProviderParams = {
  readonly providerId: ProviderId;
};

type DefaultsGroup = 'task' | 'role';

const ROLES: ReadonlyArray<AgentRole> = SELECTABLE_AGENT_ROLES;

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
};

export const DefaultsPanel = ({ workspaceId }: Props) => {
  const workspaceOverrides = useAppStore(
    (state) => state.workspaceOverrides?.[workspaceId] ?? null,
  );
  const connectedProviderIds = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const overrides = workspaceOverrides ?? EMPTY_OVERRIDES;
  const defaultProviderId =
    overrides.defaultProviderId ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  const providerPoolIds = new Set(overrides.providerPool ?? connectedProviderIds);
  providerPoolIds.add(defaultProviderId);

  const { busy, error, persistOverrides, persistTaskModel, persistRoleModel } =
    useDefaultsPersistence({ workspaceId });

  const [group, setGroup] = useState<DefaultsGroup>('task');
  const taskOverrideCount = TASKS.filter((task) => overrides.taskModels?.[task.id] != null).length;
  const roleOverrideCount = Object.keys(overrides.roleModels ?? {}).length;
  const groupOptions = [
    { value: 'task' as const, label: `Task models, ${taskOverrideCount} custom` },
    { value: 'role' as const, label: `Agent roles, ${roleOverrideCount} custom` },
  ];

  const onDefaultProvider = ({ providerId }: ProviderParams) => {
    const providerPool =
      overrides.providerPool == null
        ? null
        : Array.from(new Set([...overrides.providerPool, providerId]));
    void persistOverrides({ patch: { defaultProviderId: providerId, providerPool } });
  };

  const onToggleRoutingProvider = ({ providerId }: ProviderParams) => {
    if (providerId === defaultProviderId) {
      return;
    }
    const nextProviderIds = new Set(providerPoolIds);
    const isInPool = nextProviderIds.has(providerId);
    if (isInPool) {
      nextProviderIds.delete(providerId);
    }
    if (!isInPool) {
      nextProviderIds.add(providerId);
    }
    nextProviderIds.add(defaultProviderId);
    const selectedProviderIds = connectedProviderIds.filter((id) => nextProviderIds.has(id));
    const isEveryProviderEnabled = selectedProviderIds.length === connectedProviderIds.length;
    void persistOverrides({
      patch: { providerPool: isEveryProviderEnabled ? null : selectedProviderIds },
    });
  };

  return (
    <PaneShell
      scroll="body"
      measure="reading"
      animationClassName={SETTINGS_PANE_ENTRY}
      title="Defaults"
      description="Choose provider defaults for this workspace, its agent roles, and its auxiliary tasks."
    >
      <section className="flex flex-col gap-1">
        <SectionHeader
          label="Provider routing"
          hint="Governs every task and role below unless it has its own override."
        />
        <FieldRow label="Default provider" help="New sessions start on it and can override it.">
          <div className="w-64">
            <ProviderPicker
              connectedProviders={connectedProviderIds}
              provider={defaultProviderId}
              disabled={busy}
              onProvider={(providerId) => onDefaultProvider({ providerId })}
              align="end"
              ariaLabel="Default provider"
            />
          </div>
        </FieldRow>
        <FieldRow
          label="Routing pool"
          help="Providers Goodboy can pick on its own. New sessions start with this pool."
        >
          {connectedProviderIds.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.providers}
              tone={CONCEPT_TONE.providers}
              title="No providers connected"
              size="inline"
            />
          ) : (
            <div className="flex max-w-64 flex-wrap justify-start gap-1">
              {connectedProviderIds.map((providerId) => {
                const isDefaultProvider = providerId === defaultProviderId;
                return (
                  <ProviderChip
                    key={providerId}
                    id={providerId}
                    selected={providerPoolIds.has(providerId)}
                    disabled={busy || isDefaultProvider}
                    onClick={() => onToggleRoutingProvider({ providerId })}
                    title={isDefaultProvider ? 'Default provider is always enabled' : undefined}
                  />
                );
              })}
            </div>
          )}
        </FieldRow>
      </section>

      <section className="flex flex-col gap-3">
        <SegmentedTabs
          ariaLabel="Defaults group"
          options={groupOptions}
          value={group}
          onChange={setGroup}
          size="sm"
          fill
        />

        {group === 'task' ? (
          <div className="@container flex flex-col">
            {TASKS.map((task) => (
              <TaskModelRow
                key={task.id}
                task={task.id}
                label={task.label}
                help={task.description}
                preference={overrides.taskModels?.[task.id] ?? null}
                defaultProviderId={defaultProviderId}
                connectedProviderIds={connectedProviderIds}
                disabled={busy}
                onChange={(preference) => persistTaskModel({ task: task.id, preference })}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-2xs text-faint-foreground">
              Applies to every agent started in this role unless pinned per agent or per step.
            </p>
            <div className="flex flex-col">
              {ROLES.map((role) => (
                <RoleModelRow
                  key={role}
                  role={role}
                  label={ROLE_LABEL[role]}
                  help={ROLE_REGISTRY[role].description}
                  preference={overrides.roleModels?.[role] ?? null}
                  defaultProviderId={defaultProviderId}
                  connectedProviderIds={connectedProviderIds}
                  disabled={busy}
                  onChange={(preference) => persistRoleModel({ role, preference })}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {error != null ? <p className="text-xs text-danger">{error}</p> : null}
    </PaneShell>
  );
};

import { useState } from 'react';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import type {
  AgentRole,
  AuxTaskId,
  OverrideSettings,
  ProviderId,
  WorkspaceId,
} from '@goodboy/types';
import { ROLE_DEFAULTS, isAgentRole } from '@goodboy/core';
import { Divider, FieldRow, ScrollFade, SectionHeader } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { ProviderChip } from '../../ProviderChip';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { useAppStore } from '../../../../../store';
import { SegmentedControl } from '../../../../../shared/components/SegmentedControl';
import { PROVIDER_ORDER } from '../providerOrder';
import { RoleModelRow } from './RoleModelRow';
import { TaskModelRow } from './TaskModelRow';
import { useDefaultsPersistence } from './useDefaultsPersistence';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type ProviderParams = {
  readonly providerId: ProviderId;
};

type DefaultsGroup = 'task' | 'role';

const TASKS: ReadonlyArray<{
  readonly id: AuxTaskId;
  readonly label: string;
  readonly help: string;
}> = [
  {
    id: 'summarizer',
    label: 'Summaries',
    help: 'Condenses step output into short summaries',
  },
  {
    id: 'branch_naming',
    label: 'Branch names',
    help: 'Generates branch slugs for new sessions',
  },
  {
    id: 'plan_generation',
    label: 'Planning',
    help: 'Drafts plans and custom workflows',
  },
  {
    id: 'agent_naming',
    label: 'Agent titles',
    help: 'Names agents from your first request',
  },
  {
    id: 'pr_draft',
    label: 'PR and MR drafts',
    help: 'Default agent config when drafting pull requests',
  },
];

const ROLES: ReadonlyArray<AgentRole> = Object.keys(ROLE_DEFAULTS).filter(isAgentRole);

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  scoutFanout: null,
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
  const enabledProviderIds = new Set(overrides.enabledProviders ?? connectedProviderIds);
  enabledProviderIds.add(defaultProviderId);

  const { busy, error, persistOverrides, persistTaskModel, persistRoleModel } =
    useDefaultsPersistence({
      workspaceId,
      overrides,
    });

  const [group, setGroup] = useState<DefaultsGroup>('task');
  const taskOverrideCount = Object.keys(overrides.taskModels ?? {}).length;
  const roleOverrideCount = Object.keys(overrides.roleModels ?? {}).length;
  const groupOptions = [
    { value: 'task' as const, label: `Task models (${taskOverrideCount})` },
    { value: 'role' as const, label: `Agent roles (${roleOverrideCount})` },
  ];

  const onDefaultProvider = ({ providerId }: ProviderParams) => {
    const enabledProviders =
      overrides.enabledProviders == null
        ? undefined
        : Array.from(new Set([...overrides.enabledProviders, providerId]));
    void persistOverrides({ partial: { defaultProviderId: providerId, enabledProviders } });
  };

  const onToggleRoutingProvider = ({ providerId }: ProviderParams) => {
    if (providerId === defaultProviderId) {
      return;
    }
    const nextProviderIds = new Set(enabledProviderIds);
    if (nextProviderIds.has(providerId)) {
      nextProviderIds.delete(providerId);
    } else {
      nextProviderIds.add(providerId);
    }
    nextProviderIds.add(defaultProviderId);
    const selectedProviderIds = connectedProviderIds.filter((id) => nextProviderIds.has(id));
    const isEveryProviderEnabled = selectedProviderIds.length === connectedProviderIds.length;
    void persistOverrides({
      partial: {
        enabledProviders: isEveryProviderEnabled ? undefined : selectedProviderIds,
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-0.5 px-8 py-4">
        <h2 className="text-base font-semibold text-foreground">Defaults</h2>
        <p className="text-2xs text-muted-foreground">
          Choose provider defaults for this workspace, its agent roles, and its auxiliary tasks.
        </p>
      </div>
      <Divider />
      <ScrollFade className="flex-1" fadeFrom="background">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-6">
          <section className="flex flex-col gap-1">
            <SectionHeader
              label="Provider routing"
              hint="Governs every task and role below unless it has its own override."
            />
            <FieldRow label="Default provider" help="New sessions start on it and can override it.">
              <div className="flex max-w-64 flex-wrap justify-end gap-1">
                {PROVIDER_ORDER.map((providerId) => (
                  <ProviderChip
                    key={providerId}
                    id={providerId}
                    selected={defaultProviderId === providerId}
                    disabled={busy || !connectedProviderIds.includes(providerId)}
                    onClick={() => onDefaultProvider({ providerId })}
                    trailing={
                      connectedProviderIds.includes(providerId) ? null : (
                        <span className="text-2xs uppercase tracking-wide text-warning">
                          offline
                        </span>
                      )
                    }
                  />
                ))}
              </div>
            </FieldRow>
            <p className="text-2xs text-muted-foreground">
              Default rows follow the provider you set above.
            </p>
            <Divider />
            <FieldRow
              label="Routing pool"
              help="Providers Goodboy can pick on its own. New sessions start with this pool."
            >
              {connectedProviderIds.length === 0 ? (
                <span className="text-2xs text-muted-foreground">No providers connected</span>
              ) : (
                <div className="flex max-w-64 flex-wrap justify-end gap-1">
                  {connectedProviderIds.map((providerId) => {
                    const isDefaultProvider = providerId === defaultProviderId;
                    return (
                      <ProviderChip
                        key={providerId}
                        id={providerId}
                        selected={enabledProviderIds.has(providerId)}
                        disabled={busy || isDefaultProvider}
                        onClick={() => onToggleRoutingProvider({ providerId })}
                        title={isDefaultProvider ? 'Default provider is always enabled' : undefined}
                        trailing={
                          isDefaultProvider ? (
                            <span className="text-2xs uppercase tracking-wide text-muted-foreground/70">
                              default
                            </span>
                          ) : null
                        }
                      />
                    );
                  })}
                </div>
              )}
            </FieldRow>
          </section>

          <section className="flex flex-col gap-3">
            <SegmentedControl
              ariaLabel="Defaults group"
              options={groupOptions}
              value={group}
              onChange={setGroup}
            />

            {group === 'task' ? (
              <div className="flex flex-col">
                {TASKS.map((task, index) => (
                  <div key={task.id} className="flex flex-col">
                    {index > 0 ? <Divider /> : null}
                    <TaskModelRow
                      task={task.id}
                      label={task.label}
                      help={task.help}
                      preference={overrides.taskModels?.[task.id] ?? null}
                      defaultProviderId={defaultProviderId}
                      connectedProviderIds={connectedProviderIds}
                      disabled={busy}
                      onChange={(preference) => persistTaskModel({ task: task.id, preference })}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-2xs text-muted-foreground/70">
                  Applies to every agent spawned in this role unless pinned per agent or per step.
                </p>
                <div className="flex flex-col">
                  {ROLES.map((role, index) => (
                    <div key={role} className="flex flex-col">
                      {index > 0 ? <Divider /> : null}
                      <RoleModelRow
                        role={role}
                        label={ROLE_LABEL[role]}
                        help={ROLE_DEFAULTS[role].description}
                        preference={overrides.roleModels?.[role] ?? null}
                        defaultProviderId={defaultProviderId}
                        connectedProviderIds={connectedProviderIds}
                        disabled={busy}
                        onChange={(preference) => persistRoleModel({ role, preference })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {error != null ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </ScrollFade>
    </div>
  );
};

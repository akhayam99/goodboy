import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { OverrideSettings, ProviderId, WorkspaceId } from '@goodboy/types';
import {
  DEFAULT_GROUPS,
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  ROLE_REGISTRY,
  TASKS,
  type AutoContext,
} from '@goodboy/core';
import { EmptyState, Eyebrow, FieldRow, InlineConfirm, OverflowMenu } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { useAppStore } from '../../../../../store';
import { RoleModelRow } from './RoleModelRow';
import { TaskModelRow } from './TaskModelRow';
import { FallbackOrder } from './FallbackOrder';
import { useDefaultsPersistence } from './useDefaultsPersistence';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { ProviderPicker } from '../../../../../shared/components/RoutingPicker/ProviderPicker';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type ProviderParams = {
  readonly providerId: ProviderId;
};

const TASK_BY_ID = new Map(TASKS.map((task) => [task.id, task]));

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
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
  const orderedProviderIds = [
    ...connectedProviderIds.filter((id) => id === defaultProviderId),
    ...connectedProviderIds.filter((id) => id !== defaultProviderId),
  ];
  const fallbackOrder = orderedProviderIds.filter((id) => providerPoolIds.has(id));
  const autoContext: AutoContext = {
    defaultProvider: defaultProviderId,
    connected: connectedProviderIds,
    fallbackOrder,
  };

  const { busy, error, persistOverrides, persistTaskModel, persistRoleModel } =
    useDefaultsPersistence({ workspaceId });
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const pinnedTaskCount = TASKS.filter((task) => overrides.taskModels?.[task.id] != null).length;
  const pinnedRoleCount = Object.keys(overrides.roleModels ?? {}).length;
  const pinnedCount = pinnedTaskCount + pinnedRoleCount;

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

  const onResetAll = async () => {
    await persistOverrides({ patch: { taskModels: null, roleModels: null } });
    setIsConfirmingReset(false);
  };

  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title="Defaults"
      {...(pinnedCount > 0 && { meta: `${pinnedCount} pinned` })}
      actions={
        <OverflowMenu
          label="Defaults actions"
          disabled={busy}
          items={[
            {
              kind: 'item',
              key: 'reset-all',
              label: 'Reset all to Auto',
              icon: RotateCcw,
              disabled: pinnedCount === 0,
              destructive: true,
              onClick: () => setIsConfirmingReset(true),
            },
          ]}
        />
      }
    >
      {isConfirmingReset ? (
        <InlineConfirm
          role="danger"
          icon={<RotateCcw size={ICON_SIZE.control} aria-hidden />}
          title={`Reset ${pinnedCount} pinned ${pinnedCount === 1 ? 'model' : 'models'} to Auto?`}
          description="Every agent role and background task goes back to Auto."
          confirmLabel="Reset all"
          isBusy={busy}
          onConfirm={onResetAll}
          onCancel={() => setIsConfirmingReset(false)}
        />
      ) : null}

      <section aria-label="Providers" className="flex flex-col gap-1">
        <Eyebrow label="Providers" />
        <FieldRow label="Default provider" help="Auto starts here.">
          <div className="w-[220px]">
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
          label="Fallback order"
          help="If a provider is not connected or out of quota, Auto moves to the next one."
        >
          {connectedProviderIds.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.providers}
              tone={CONCEPT_TONE.providers}
              title="No providers connected"
              size="inline"
            />
          ) : (
            <FallbackOrder
              providerIds={orderedProviderIds}
              poolIds={providerPoolIds}
              defaultProviderId={defaultProviderId}
              disabled={busy}
              onToggle={(providerId) => onToggleRoutingProvider({ providerId })}
            />
          )}
        </FieldRow>
      </section>

      <section aria-label="Agents" className="flex flex-col gap-3">
        <Eyebrow label="Agents" />
        {DEFAULT_GROUPS.agents.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className="flex flex-col">
            <Eyebrow label={group.label} muted />
            {group.members.map((role) => (
              <RoleModelRow
                key={role}
                role={role}
                label={ROLE_LABEL[role]}
                help={ROLE_REGISTRY[role].summary}
                preference={overrides.roleModels?.[role] ?? null}
                autoContext={autoContext}
                connectedProviderIds={connectedProviderIds}
                disabled={busy}
                onChange={(preference) => persistRoleModel({ role, preference })}
              />
            ))}
          </div>
        ))}
      </section>

      <section aria-label="Background tasks" className="flex flex-col gap-3">
        <Eyebrow label="Background tasks" />
        {DEFAULT_GROUPS.tasks.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className="flex flex-col">
            <Eyebrow label={group.label} muted />
            {group.members.map((taskId) => {
              const task = TASK_BY_ID.get(taskId);
              if (task == null) {
                return null;
              }
              return (
                <TaskModelRow
                  key={task.id}
                  task={task.id}
                  label={task.label}
                  help={task.description}
                  preference={overrides.taskModels?.[task.id] ?? null}
                  defaultProviderId={defaultProviderId}
                  fallbackOrder={fallbackOrder}
                  connectedProviderIds={connectedProviderIds}
                  disabled={busy}
                  onChange={(preference) => persistTaskModel({ task: task.id, preference })}
                />
              );
            })}
          </div>
        ))}
      </section>

      {error != null ? <p className="text-xs text-danger">{error}</p> : null}
    </PaneShell>
  );
};

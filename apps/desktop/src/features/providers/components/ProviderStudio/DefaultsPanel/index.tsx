import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import {
  DEFAULT_GROUPS,
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  ROLE_REGISTRY,
  TASKS,
  firstOnProvider,
  type AutoContext,
} from '@goodboy/core';
import {
  Band,
  BandStack,
  Eyebrow,
  FieldRow,
  InlineConfirm,
  OverflowMenu,
  PaneShell,
  FilledEmptyState,
} from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { useAppStore } from '../../../../../store';
import { NAMES } from '../../../../../shared/names';
import { useChatDefaultModel } from '../../../../../shared/hooks/useChatDefaultModel';
import { ChatModelRow } from './ChatModelRow';
import { RoleRow } from './RoleRow';
import { TaskModelRow } from './TaskModelRow';
import { ProvidersInOrder } from './ProvidersInOrder';
import { useDefaultsPersistence } from './useDefaultsPersistence';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { useAutoLimitContext } from '../../../hooks/useAutoLimitContext';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly focusSection?: string;
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
  afterMerge: null,
  defaultBranchTemplate: null,
};

export const DefaultsPanel = ({ workspaceId, focusSection }: Props) => {
  const tasksRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusSection === undefined || !TASKS.some((task) => task.id === focusSection)) {
      return;
    }
    tasksRef.current
      ?.querySelector(`[data-default-row="${focusSection}"]`)
      ?.scrollIntoView({ block: 'center' });
  }, [focusSection]);
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
  const policy = overrides.providerPool;
  const defaultProviderId =
    firstOnProvider({ policy }) ??
    overrides.defaultProviderId ??
    DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  const limitContext = useAutoLimitContext();
  const autoContext: AutoContext = {
    defaultProvider: defaultProviderId,
    connected: connectedProviderIds,
    ...(policy != null && { policy }),
    ...(limitContext?.hidden != null && { hidden: limitContext.hidden }),
    ...(limitContext?.cliVersions != null && { cliVersions: limitContext.cliVersions }),
  };

  const chatDefault = useChatDefaultModel({ workspaceId });
  const { busy, error, persistOverrides, persistTaskModel, persistRoleModel } =
    useDefaultsPersistence({ workspaceId });
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const pinnedTaskCount = TASKS.filter((task) => overrides.taskModels?.[task.id] != null).length;
  const pinnedRoleCount = Object.keys(overrides.roleModels ?? {}).length;
  const pinnedChatCount = chatDefault.saved === null ? 0 : 1;
  const pinnedCount = pinnedTaskCount + pinnedRoleCount + pinnedChatCount;

  const onResetAll = async () => {
    chatDefault.clear();
    await persistOverrides({ patch: { taskModels: null, roleModels: null } });
    setIsConfirmingReset(false);
  };

  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title={NAMES.models}
      {...(pinnedCount > 0 && { meta: `${pinnedCount} pinned` })}
      actions={
        <OverflowMenu
          label="Models actions"
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
          description="New chats, every agent role and background task go back to Auto."
          confirmLabel="Reset all"
          isBusy={busy}
          onConfirm={onResetAll}
          onCancel={() => setIsConfirmingReset(false)}
        />
      ) : null}

      <section aria-label="Providers" className="flex flex-col gap-1">
        <Eyebrow label="Providers" />
        {connectedProviderIds.length === 0 ? (
          <FieldRow label="Providers, in order">
            <FilledEmptyState
              icon={CONCEPT_ICONS.providers}
              tone={CONCEPT_TONE.providers}
              title="No providers connected"
            />
          </FieldRow>
        ) : (
          <ProvidersInOrder workspaceId={workspaceId} />
        )}
      </section>

      <section aria-label="Chat" className="flex flex-col gap-2">
        <Eyebrow label="Chat" />
        <BandStack>
          <Band>
            <ChatModelRow
              workspaceId={workspaceId}
              connectedProviderIds={connectedProviderIds}
              disabled={busy}
            />
          </Band>
        </BandStack>
      </section>

      <section aria-label="Agents" className="flex flex-col gap-2">
        <Eyebrow label="Agents" />
        <BandStack>
          {DEFAULT_GROUPS.agents.map((group) => (
            <div key={group.id} role="group" aria-label={group.label}>
              <Band
                groupLabel={group.members.length > 1 ? group.label : undefined}
                groupMeta={pluralize(group.members.length, 'role')}
              >
                {group.members.map((role) => (
                  <RoleRow
                    key={role}
                    role={role}
                    label={ROLE_LABEL[role]}
                    help={ROLE_REGISTRY[role].summary}
                    preference={overrides.roleModels?.[role] ?? null}
                    autoContext={autoContext}
                    isParallelOn={overrides.parallelAgents === true}
                    connectedProviderIds={connectedProviderIds}
                    disabled={busy}
                    onChange={(preference) => persistRoleModel({ role, preference })}
                  />
                ))}
              </Band>
            </div>
          ))}
        </BandStack>
      </section>

      <section ref={tasksRef} aria-label="Background tasks" className="flex flex-col gap-2">
        <Eyebrow label="Background tasks" />
        <BandStack>
          {DEFAULT_GROUPS.tasks.map((group) => (
            <div key={group.id} role="group" aria-label={group.label}>
              <Band
                groupLabel={group.members.length > 1 ? group.label : undefined}
                groupMeta={pluralize(group.members.length, 'task')}
              >
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
                      providerPolicy={policy}
                      connectedProviderIds={connectedProviderIds}
                      disabled={busy}
                      onChange={(preference) => persistTaskModel({ task: task.id, preference })}
                    />
                  );
                })}
              </Band>
            </div>
          ))}
        </BandStack>
      </section>

      {error != null ? <p className="text-label text-danger">{error}</p> : null}
    </PaneShell>
  );
};

import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import { DEFAULT_GROUPS, ROLE_REGISTRY, TASKS } from '@goodboy/core';
import {
  Band,
  BandStack,
  Button,
  ConfirmPopover,
  Eyebrow,
  FieldRow,
  PaneShell,
  EmptyState,
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
import { PinnedOffLine } from './PinnedOffLine';
import { ProjectOverridesNotice } from './ProjectOverridesNotice';
import { useDefaultsPersistence } from './useDefaultsPersistence';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { useModelScope } from '../../../hooks/useModelScope';
import { resolutionOf } from '../../../../../store/slices/models/selectResolution';
import { isPinUnrunnable } from './resolutionNote';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly scopeLabel?: string | null;
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

export const DefaultsPanel = ({ workspaceId, scopeLabel = null, focusSection }: Props) => {
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
  const scope = useModelScope({ workspaceId });

  const chatDefault = useChatDefaultModel({ workspaceId });
  const { busy, error, persistOverrides, persistTaskModel, persistRoleModel, clearRoleModels } =
    useDefaultsPersistence({ workspaceId });

  const pinnedTaskCount = TASKS.filter((task) => overrides.taskModels?.[task.id] != null).length;
  const pinnedRoleCount = Object.keys(overrides.roleModels ?? {}).length;
  const pinnedChatCount = chatDefault.saved === null ? 0 : 1;
  const pinnedCount = pinnedTaskCount + pinnedRoleCount + pinnedChatCount;

  const shownRoles = DEFAULT_GROUPS.agents.flatMap((group) => group.members);
  const unrunnableRoles = shownRoles.filter((role) =>
    isPinUnrunnable({ resolution: resolutionOf({ scope, slot: { kind: 'role', id: role } }) }),
  );
  const onProviderIds = connectedProviderIds.filter(
    (id) => policy == null || policy.some((entry) => entry.id === id && entry.state === 'on'),
  );

  const onResetAll = async () => {
    chatDefault.clear();
    await persistOverrides({ patch: { taskModels: null, roleModels: null } });
  };

  return (
    <PaneShell
      scroll="body"
      animationClassName={SETTINGS_PANE_ENTRY}
      title={NAMES.models}
      meta={scopeLabel ?? undefined}
      actions={
        pinnedCount === 0 ? undefined : (
          <ConfirmPopover
            role="danger"
            icon={<RotateCcw size={ICON_SIZE.control} aria-hidden />}
            title={`Reset ${pinnedCount} pinned ${pinnedCount === 1 ? 'model' : 'models'} to Auto?`}
            description="New chats, every agent role and background task go back to Auto."
            confirmLabel="Reset all"
            isBusy={busy}
            align="end"
            onConfirm={onResetAll}
            trigger={({ arm }) => (
              <Button size="sm" variant="ghost" disabled={busy} onClick={arm}>
                <RotateCcw size={ICON_SIZE.row} aria-hidden />
                Reset all to Auto
              </Button>
            )}
          />
        )
      }
    >
      <ProjectOverridesNotice workspaceId={workspaceId} />

      <PinnedOffLine
        count={unrunnableRoles.length}
        total={shownRoles.length}
        onProviderIds={onProviderIds}
        isDisabled={busy}
        onConfirm={() => clearRoleModels({ roles: unrunnableRoles })}
      />

      <section aria-label="Providers" className="flex flex-col gap-1">
        <Eyebrow label="Providers" />
        {connectedProviderIds.length === 0 ? (
          <FieldRow label="When a provider is out">
            <EmptyState
              size="section"
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
                    workspaceId={workspaceId}
                    role={role}
                    label={ROLE_LABEL[role]}
                    help={ROLE_REGISTRY[role].summary}
                    preference={overrides.roleModels?.[role] ?? null}
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
                      workspaceId={workspaceId}
                      task={task.id}
                      label={task.label}
                      help={task.description}
                      preference={overrides.taskModels?.[task.id] ?? null}
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

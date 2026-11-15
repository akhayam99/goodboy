import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import { ROLE_REGISTRY } from '@goodboy/core/roles';
import { DEFAULT_GROUPS, TASKS } from '@goodboy/core/settings';
import {
  Band,
  Button,
  ConfirmPopover,
  EmptyState,
  FieldRow,
  ICON_SIZE,
  PaneShell,
  appScrollIntoView,
} from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { useAppStore } from '../../../../../store';
import { NAMES } from '../../../../../shared/utils/names';
import { useChatDefaultModel } from '../../../../../shared/hooks/useChatDefaultModel';
import { ChatModelRow } from './ChatModelRow';
import { ConnectionsPointer } from './ConnectionsPointer';
import { DefaultsGroup } from './DefaultsGroup';
import { RoleRow } from './RoleRow';
import { RunsSection } from './RunsSection';
import { TaskModelRow } from './TaskModelRow';
import { ClassifyRequestsRow } from './ClassifyRequestsRow';
import { OrchestratorModelPickRow } from './OrchestratorModelPickRow';
import { ProvidersInOrder } from './ProvidersInOrder';
import { PinnedOffLine } from './PinnedOffLine';
import { SavedModelsNotice } from './SavedModelsNotice';
import { useDefaultsPersistence } from './useDefaultsPersistence';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { useModelScope } from '../../../hooks/useModelScope';
import { resolutionOf } from '../../../../../store/runtime/models/selectResolution';
import { isPinUnrunnable } from './resolutionNote';
import { actionButtonLookOf } from '../../../../actions/actionButtonLookOf';

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
  const rowsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusSection === undefined || !TASKS.some((task) => task.id === focusSection)) {
      return;
    }
    appScrollIntoView({
      element: rowsRef.current?.querySelector(`[data-default-row="${focusSection}"]`),
      block: 'center',
    });
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
        pinnedCount === 0 || unrunnableRoles.length > 0 ? undefined : (
          <ConfirmPopover
            role="danger"
            icon={<RotateCcw size={ICON_SIZE.control} aria-hidden />}
            title={`Reset ${pinnedCount} pinned ${pinnedCount === 1 ? 'model' : 'models'} to Auto?`}
            description="New chats, every agent role and background task go back to Auto."
            confirmLabel="Reset all"
            isBusy={busy}
            onConfirm={onResetAll}
            trigger={({ arm }) => (
              <Button
                size="sm"
                {...actionButtonLookOf({ verb: 'defaults.reset', variant: 'ghost' })}
                disabled={busy}
                onClick={arm}
              >
                <RotateCcw size={ICON_SIZE.row} aria-hidden />
                Reset all to Auto
              </Button>
            )}
          />
        )
      }
    >
      <ConnectionsPointer />

      <SavedModelsNotice workspaceId={workspaceId} />

      <PinnedOffLine
        count={unrunnableRoles.length}
        total={shownRoles.length}
        onProviderIds={onProviderIds}
        isDisabled={busy}
        onConfirm={() => clearRoleModels({ roles: unrunnableRoles })}
      />

      <div ref={rowsRef} className="contents">
        <RunsSection
          workspaceId={workspaceId}
          overrides={overrides}
          connectedProviderIds={connectedProviderIds}
          isDisabled={busy}
          onRoleChange={persistRoleModel}
          onTaskChange={persistTaskModel}
        />

        <Band label="Providers" ariaLabel="Providers" headingLevel={2} inset="content">
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
        </Band>

        <Band label="Choosing models" ariaLabel="Choosing models" headingLevel={2} inset="content">
          <div className="flex flex-col">
            <OrchestratorModelPickRow workspaceId={workspaceId} />
            <ClassifyRequestsRow />
          </div>
        </Band>

        <Band label="Chat" ariaLabel="Chat" headingLevel={2}>
          <ChatModelRow
            workspaceId={workspaceId}
            connectedProviderIds={connectedProviderIds}
            disabled={busy}
          />
        </Band>

        <Band label="Agents" ariaLabel="Agents" headingLevel={2}>
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
                  disabled={busy}
                  onChange={(preference) => persistRoleModel({ role, preference })}
                />
              ))}
            </DefaultsGroup>
          ))}
        </Band>

        <Band label="Background tasks" ariaLabel="Background tasks" headingLevel={2}>
          {DEFAULT_GROUPS.tasks.map((group) => (
            <DefaultsGroup key={group.id} label={group.label}>
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
            </DefaultsGroup>
          ))}
        </Band>
      </div>

      {error != null ? <p className="text-meta text-danger">{error}</p> : null}
    </PaneShell>
  );
};

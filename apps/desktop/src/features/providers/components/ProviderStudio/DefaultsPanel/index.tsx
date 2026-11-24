import { useEffect, useRef } from 'react';
import { RotateCcw } from '@goodboy/ui/icons';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
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
import { useAppStore } from '../../../../../store';
import { NAMES } from '../../../../../shared/utils/names';
import { useChatDefaultModel } from '../../../../../shared/hooks/useChatDefaultModel';
import { ChatModelRow } from './ChatModelRow';
import { ConnectionsPointer } from './ConnectionsPointer';
import { DefaultsGroup } from './DefaultsGroup';
import { TaskModelRow } from './TaskModelRow';
import { ProvidersInOrder } from './ProvidersInOrder';
import { SavedModelsNotice } from './SavedModelsNotice';
import { useDefaultsPersistence } from './useDefaultsPersistence';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { SETTINGS_PANE_ENTRY } from '../../../../settings/components/SettingsStudio/settingsPaneEntry';
import { actionButtonLookOf } from '../../../../actions/actionButtonLookOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly scopeLabel?: string | null;
  readonly focusSection?: string;
};

const TASK_BY_ID = new Map(TASKS.map((task) => [task.id, task]));

const BACKGROUND_TASK_IDS: ReadonlySet<string> = new Set(
  DEFAULT_GROUPS.tasks.flatMap((group) => group.members),
);

type RunTaskModelsParams = {
  readonly taskModels: OverrideSettings['taskModels'];
};

const runTaskModelsOf = ({ taskModels }: RunTaskModelsParams): OverrideSettings['taskModels'] => {
  const kept = Object.entries(taskModels ?? {}).filter(([task]) => !BACKGROUND_TASK_IDS.has(task));
  return kept.length > 0 ? Object.fromEntries(kept) : null;
};

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

  const chatDefault = useChatDefaultModel({ workspaceId });
  const { busy, error, persistOverrides, persistTaskModel } = useDefaultsPersistence({
    workspaceId,
  });

  const pinnedTaskCount = TASKS.filter(
    (task) => BACKGROUND_TASK_IDS.has(task.id) && overrides.taskModels?.[task.id] != null,
  ).length;
  const pinnedChatCount = chatDefault.saved === null ? 0 : 1;
  const pinnedCount = pinnedTaskCount + pinnedChatCount;

  const onResetAll = async () => {
    chatDefault.clear();
    await persistOverrides({
      patch: { taskModels: runTaskModelsOf({ taskModels: overrides.taskModels }) },
    });
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
            description="New chats and every background task go back to Auto."
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

      <div ref={rowsRef} className="contents">
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

        <Band label="Chat" ariaLabel="Chat" headingLevel={2}>
          <ChatModelRow
            workspaceId={workspaceId}
            connectedProviderIds={connectedProviderIds}
            disabled={busy}
          />
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

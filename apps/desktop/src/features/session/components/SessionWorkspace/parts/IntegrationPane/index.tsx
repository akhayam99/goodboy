import { useState } from 'react';
import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { PaneShell, cn, formatError } from '@goodboy/ui';
import { Unlink } from 'lucide-react';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { PANE_RHYTHM } from '@goodboy/ui';
import { FocusedTaskBody } from './FocusedTaskBody';
import { PROVIDER_META } from './providerMeta';
import { isTaskOnScreen } from './isTaskOnScreen';
import { TaskPlacementMenu } from './TaskPlacementMenu';
import { RecordFrameContext } from '../../../../../../shared/components/StudioDetail/RecordFrameContext';
import type { RecordFrame } from '../../../../../../shared/components/StudioDetail/RecordActions/types';
import { GoneObject } from '../../../../../../shared/components/GoneObject';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../../shared/utils/names';
import { useSessionProjectScope } from '../../../../hooks/useSessionProjectScope';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: Exclude<SessionExternalTaskProvider, 'github' | 'sentry'>;
};

type UnlinkParams = {
  readonly task: SessionExternalTask;
};

export const IntegrationPane = ({ sessionId, workspaceId, provider }: Props) => {
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const externalTasks = useAppStore(
    (state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY,
  );
  const openedTask = useAppStore((state) => state.focusedExternalTask[sessionId] ?? null);
  const navigate = useAppStore((state) => state.navigate);
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const githubConnection = useGithubConnection({ workspaceId });
  const projectScope = useSessionProjectScope({ sessionId });
  const tasks = externalTasks.filter((task) => task.provider === provider);
  const meta = PROVIDER_META[provider];
  const connection = resolveIntegrationConnection({
    provider,
    integrations,
    externalTasks,
    isGithubAuthenticated:
      githubConnection.isResolved === false || githubConnection.isAuthenticated,
  });
  const focusedTask =
    openedTask === null || openedTask.provider !== provider
      ? null
      : (tasks.find(
          (task) =>
            task.externalId === openedTask.externalId &&
            (task.projectId ?? null) === openedTask.projectId,
        ) ?? null);
  const handleUnlink = async ({ task }: UnlinkParams) => {
    setUnlinkError(null);
    setIsUnlinking(true);
    const drawer = useAppStore.getState().drawer ?? null;
    try {
      await unlinkSessionExternalTask(sessionId, provider, task.externalId, task.projectId);
      const state = useAppStore.getState();
      if (!isTaskOnScreen({ state, workspaceId, sessionId, provider, task, drawer })) {
        return;
      }
      navigate({ to: sessionPlace({ sessionId, lens: null }), mode: 'replace' });
    } catch (error) {
      setUnlinkError(formatError(error));
    } finally {
      setIsUnlinking(false);
    }
  };

  if (focusedTask != null) {
    const frame: RecordFrame = {
      primary: null,
      onRefresh: null,
      onClose: null,
      sessionVerbs: [
        {
          key: 'unlink-session',
          label: NAMES.removeLinkFromSession,
          icon: Unlink,
          isBusy: isUnlinking,
          blockedReason: null,
          confirm: {
            title: `Remove the link to ${focusedTask.identifier} from this session?`,
            description: `The issue stays in ${meta.label}. Link it again from Link work.`,
            confirmLabel: 'Unlink',
          },
          onRun: () => handleUnlink({ task: focusedTask }),
        },
      ],
      linkFacts: [
        {
          slot: 'links',
          key: 'placement',
          label: 'Placed on',
          icon: null,
          node: <TaskPlacementMenu sessionId={sessionId} task={focusedTask} />,
        },
      ],
    };
    return (
      <RecordFrameContext.Provider value={frame}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          {unlinkError != null ? (
            <p className={cn('shrink-0 pt-3 text-meta text-danger', PANE_RHYTHM.inset)}>
              {unlinkError}
            </p>
          ) : null}
          <FocusedTaskBody
            provider={provider}
            sessionId={sessionId}
            workspaceId={workspaceId}
            task={focusedTask}
            projectId={focusedTask.projectId ?? projectScope}
            isConnected={connection.isConnected}
          />
        </div>
      </RecordFrameContext.Provider>
    );
  }

  return (
    <PaneShell title={meta.label}>
      <GoneObject
        noun="record"
        icon={CONCEPT_ICONS.integrations}
        onBack={() => navigate({ to: sessionPlace({ sessionId, lens: null }), mode: 'replace' })}
      />
    </PaneShell>
  );
};

import { useMemo, useState } from 'react';
import { Check, Unlink } from 'lucide-react';
import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { cn, CountToggle, formatError, PaneShell } from '@goodboy/ui';
import { EmptyState } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { selectSessionById } from '../../../../../../store/slices/sessions/selectSessionById';
import { selectActiveProjectPrs } from '../../../../../../store/slices/github/activeProjectPrs';
import { ConnectIntegrationEmptyState } from '../../../../../integrations/ConnectIntegrationEmptyState';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useSessionRepo } from '../../../../../../store/slices/worktrees/useSessionRepo';
import { branchRequests } from '../../../../branchRequests';
import { buildWorkItems } from '../../../../workItems';
import { FocusedTaskBody } from './FocusedTaskBody';
import { integrationTaskKey } from './integrationTaskKey';
import { isTaskOnScreen } from './isTaskOnScreen';
import { TaskPlacementMenu } from './TaskPlacementMenu';
import { RecordFrameContext } from '../../../../../../shared/components/StudioDetail/RecordFrameContext';
import type { RecordFrame } from '../../../../../../shared/components/StudioDetail/RecordActions/types';
import { WorkItemList } from './WorkItemList';
import { useSessionProjectScope } from '../../../../hooks/useSessionProjectScope';
import { PROVIDER_LENS } from '../../../../../integrations/providerLens';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';
import { LinkIssueAction } from '../../../SessionOverviewPane/LinkIssueAction';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: Exclude<SessionExternalTaskProvider, 'github' | 'sentry'>;
};

type ProviderMeta = Readonly<{
  label: string;
  nounPlural: string;
  linkHint: string;
}>;

type UnlinkParams = {
  readonly task: SessionExternalTask;
};

type OpenTaskParams = {
  readonly taskKey: string;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: {
    label: 'Linear',
    nounPlural: 'issues',
    linkHint: 'Search your assigned Linear issues or paste a URL to link one to this session.',
  },
  sentry: {
    label: 'Sentry',
    nounPlural: 'issues',
    linkHint: 'Search your assigned Sentry issues or paste a URL to link one to this session.',
  },
  gitlab: {
    label: 'GitLab',
    nounPlural: 'issues',
    linkHint: 'Search your assigned GitLab issues or paste a URL to link one to this session.',
  },
  jira: {
    label: 'Jira',
    nounPlural: 'issues',
    linkHint: 'Search your assigned Jira issues or paste a URL to link one to this session.',
  },
  github: {
    label: 'GitHub',
    nounPlural: 'issues',
    linkHint: 'Search your assigned GitHub issues or paste a URL to link one to this session.',
  },
  bitbucket: {
    label: 'Bitbucket',
    nounPlural: 'pull requests',
    linkHint: 'Paste a Bitbucket pull request URL to link one to this session.',
  },
  slack: {
    label: 'Slack',
    nounPlural: 'threads',
    linkHint: 'Pick a thread from a channel you are in, or paste a Slack permalink to link one.',
  },
};

export const IntegrationPane = ({ sessionId, workspaceId, provider }: Props) => {
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const externalTasks = useAppStore(
    (state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY,
  );
  const openedTask = useAppStore((state) => state.focusedExternalTask[sessionId] ?? null);
  const openExternalTaskLens = useAppStore((state) => state.openExternalTaskLens);
  const navigate = useAppStore((state) => state.navigate);
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const githubConnection = useGithubConnection({ workspaceId });
  const sessionBranch = useSessionRepo({ sessionId })?.branch ?? null;
  const projectScope = useSessionProjectScope({ sessionId });
  const branchPrs = useAppStore((state) => selectActiveProjectPrs({ state, sessionId }));
  const mergeRequest = useAppStore((state) => state.sessionGitlabMr[sessionId]?.mr ?? null);
  const tasks = useMemo(
    () => externalTasks.filter((task) => task.provider === provider),
    [externalTasks, provider],
  );
  const meta = PROVIDER_META[provider];
  const connection = resolveIntegrationConnection({
    provider,
    integrations,
    externalTasks,
    isGithubAuthenticated:
      githubConnection.isResolved === false || githubConnection.isAuthenticated,
  });
  const hasTasks = tasks.length > 0;
  const session = useAppStore((state) => selectSessionById(state, sessionId));
  const linkAction =
    session === null ? undefined : <LinkIssueAction session={session} initialSource={provider} />;
  const focusedTask =
    openedTask === null || openedTask.provider !== provider
      ? null
      : (tasks.find(
          (task) =>
            task.externalId === openedTask.externalId &&
            (task.projectId ?? null) === openedTask.projectId,
        ) ?? null);
  const openTask = ({ taskKey }: OpenTaskParams) => {
    const task = tasks.find((candidate) => integrationTaskKey({ task: candidate }) === taskKey);
    if (task === undefined) {
      return;
    }
    openExternalTaskLens(sessionId, task);
  };
  const workItems = buildWorkItems({
    tasks,
    currentBranch: sessionBranch,
    branchPrs: branchRequests({ prs: branchPrs, mr: mergeRequest, branch: sessionBranch }),
  });

  const handleUnlink = async ({ task }: UnlinkParams) => {
    setUnlinkError(null);
    setIsUnlinking(true);
    try {
      await unlinkSessionExternalTask(sessionId, provider, task.externalId, task.projectId);
      const state = useAppStore.getState();
      if (!isTaskOnScreen({ state, workspaceId, sessionId, provider, task })) {
        return;
      }
      navigate({ to: sessionPlace({ sessionId, lens: PROVIDER_LENS[provider] }), mode: 'replace' });
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
          label: 'Unlink from session',
          icon: Unlink,
          isBusy: isUnlinking,
          blockedReason: null,
          confirm: {
            title: `Unlink ${focusedTask.identifier} from this session?`,
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
            <p className={cn('shrink-0 pt-3 text-label text-danger', PANE_RHYTHM.inset)}>
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
    <PaneShell
      title={meta.label}
      actions={connection.isConnected && hasTasks ? linkAction : undefined}
    >
      {!connection.isConnected ? (
        <ConnectIntegrationEmptyState provider={provider} workspaceId={workspaceId} compact />
      ) : null}
      {connection.isConnected && !hasTasks ? (
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.integrations}
          tone={CONCEPT_TONE.integrations}
          title={`No ${meta.label} ${meta.nounPlural} linked`}
          description={meta.linkHint}
          action={linkAction}
        />
      ) : null}
      <WorkItemList
        items={workItems.current}
        providerLabel={meta.label}
        onSelect={(taskKey) => openTask({ taskKey })}
      />
      <div className="flex justify-center">
        <CountToggle
          label="completed"
          count={workItems.history.length}
          isShown={showHistory}
          icon={Check}
          onChange={setShowHistory}
        />
      </div>
      {showHistory && workItems.history.length > 0 ? (
        <WorkItemList
          items={workItems.history}
          providerLabel={meta.label}
          onSelect={(taskKey) => openTask({ taskKey })}
        />
      ) : null}
      {unlinkError != null ? <p className="text-label text-danger">{unlinkError}</p> : null}
    </PaneShell>
  );
};

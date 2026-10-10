import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Unlink } from 'lucide-react';
import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { cn, CountToggle, formatError, PaneShell, PaneActionsContext } from '@goodboy/ui';
import { EmptyState } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { selectSessionById } from '../../../../../../store/slices/sessions/selectSessionById';
import { selectActiveProjectPrs } from '../../../../../../store/slices/github/activeProjectPrs';
import { ConnectIntegrationEmptyState } from '../../../../../integrations/ConnectIntegrationEmptyState';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { GhostActionButton } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { useSessionRepo } from '../../../../../../store/slices/worktrees/useSessionRepo';
import { branchRequests } from '../../../../branchRequests';
import { buildWorkItems } from '../../../../workItems';
import { FocusedTaskBody } from './FocusedTaskBody';
import { integrationTaskKey } from './integrationTaskKey';
import { LinkedToRow } from './LinkedToRow';
import { WorkItemList } from './WorkItemList';
import { useSessionProjectScope } from '../../../../hooks/useSessionProjectScope';
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
  const openedTaskKey =
    openedTask?.provider === provider ? integrationTaskKey({ task: openedTask }) : null;
  const [focusedTaskKey, setFocusedTaskKey] = useState<string | null>(openedTaskKey);
  useEffect(() => {
    if (openedTaskKey == null) {
      return;
    }
    setFocusedTaskKey(openedTaskKey);
  }, [openedTaskKey]);
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
  const lastFocused = useRef<SessionExternalTask | null>(null);
  const anchor = lastFocused.current ?? (openedTask?.provider === provider ? openedTask : null);
  const focusedTask =
    tasks.find((task) => integrationTaskKey({ task }) === focusedTaskKey) ??
    (focusedTaskKey === null || anchor === null
      ? null
      : (tasks.find(
          (task) =>
            task.externalId === anchor.externalId &&
            (task.projectId ?? null) === (anchor.projectId ?? null),
        ) ?? null));
  useEffect(() => {
    lastFocused.current = focusedTask;
  }, [focusedTask]);
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
      setFocusedTaskKey(null);
    } catch (error) {
      setUnlinkError(formatError(error));
    } finally {
      setIsUnlinking(false);
    }
  };

  if (focusedTask != null) {
    return (
      <PaneActionsContext.Provider
        value={
          <div className="flex items-center gap-2">
            <GhostActionButton
              icon={ArrowLeft}
              label={`All ${meta.nounPlural}`}
              onClick={() => setFocusedTaskKey(null)}
            />
            <GhostActionButton
              icon={Unlink}
              tone="danger"
              label="Unlink"
              ariaLabel={`Unlink ${focusedTask.identifier}`}
              disabled={isUnlinking}
              onClick={() => void handleUnlink({ task: focusedTask })}
            />
          </div>
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          {unlinkError != null ? (
            <p className={cn('shrink-0 pt-3 text-label text-danger', PANE_RHYTHM.inset)}>
              {unlinkError}
            </p>
          ) : null}
          <LinkedToRow sessionId={sessionId} task={focusedTask} />
          <FocusedTaskBody
            provider={provider}
            sessionId={sessionId}
            workspaceId={workspaceId}
            task={focusedTask}
            projectId={focusedTask.projectId ?? projectScope}
            isConnected={connection.isConnected}
          />
        </div>
      </PaneActionsContext.Provider>
    );
  }

  return (
    <PaneShell
      title={meta.label}
      meta={hasTasks ? tasks.length : undefined}
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
        onSelect={setFocusedTaskKey}
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
          onSelect={setFocusedTaskKey}
        />
      ) : null}
      {unlinkError != null ? <p className="text-label text-danger">{unlinkError}</p> : null}
    </PaneShell>
  );
};

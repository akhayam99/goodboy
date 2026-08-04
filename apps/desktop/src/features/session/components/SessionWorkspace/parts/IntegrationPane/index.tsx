import { useMemo, useState } from 'react';
import { ArrowLeft, Unlink } from 'lucide-react';
import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { InlineConfirm, cn } from '@goodboy/ui';
import { LensEmptyState } from '../../../../../../shared/components/LensEmptyState';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { formatError } from '../../../../../../shared/lib/errors';
import { ConnectIntegrationEmptyState } from '../../../../../integrations/ConnectIntegrationEmptyState';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { GithubConnectionEmptyState } from '../../../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { useRemoteHostKind } from '../../../../../worktree/useRemoteHostKind';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { GhostActionButton } from '../../../../../../shared/components/GhostActionButton';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { PANE_RHYTHM } from '../../../../../../shared/components/paneRhythm';
import { FocusedTaskBody } from './FocusedTaskBody';
import { IntegrationTaskCard } from './IntegrationTaskCard';
import { integrationTaskKey } from './integrationTaskKey';
import { LinkTicketPopover } from './LinkTicketPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
};

type ProviderMeta = Readonly<{
  label: string;
}>;

type UnlinkParams = {
  readonly task: SessionExternalTask;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: { label: 'Linear' },
  sentry: { label: 'Sentry' },
  gitlab: { label: 'GitLab' },
  github: { label: 'GitHub' },
};

export const IntegrationPane = ({ sessionId, workspaceId, provider }: Props) => {
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isUnlinkArmed, setIsUnlinkArmed] = useState(false);
  const [focusedTaskKey, setFocusedTaskKey] = useState<string | null>(null);
  const externalTasks = useAppStore(
    (state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY,
  );
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const remoteKind = useRemoteHostKind({ sessionId });
  const githubConnection = useGithubConnection({ workspaceId });
  const tasks = useMemo(
    () => externalTasks.filter((task) => task.provider === provider),
    [externalTasks, provider],
  );
  const meta = PROVIDER_META[provider];
  const connection = resolveIntegrationConnection({
    provider,
    integrations,
    remoteKind,
    externalTasks,
    isGithubAuthenticated:
      provider !== 'github' ||
      githubConnection.isResolved === false ||
      githubConnection.isAuthenticated,
  });
  const hasTasks = tasks.length > 0;
  const linkAction = (
    <LinkTicketPopover
      sessionId={sessionId}
      workspaceId={workspaceId}
      provider={provider}
      providerLabel={meta.label}
    />
  );
  const autoFocusedTask = connection.isConnected && tasks.length === 1 ? (tasks[0] ?? null) : null;
  const focusedTask =
    tasks.find((task) => integrationTaskKey({ task }) === focusedTaskKey) ?? autoFocusedTask;

  const handleUnlink = async ({ task }: UnlinkParams) => {
    const mountWorkspaceId = task.mountWorkspaceId;
    setUnlinkError(null);
    setIsUnlinking(true);
    try {
      const unlink =
        mountWorkspaceId == null
          ? () => unlinkSessionExternalTask(sessionId, provider, task.externalId)
          : () => unlinkSessionExternalTask(sessionId, provider, task.externalId, mountWorkspaceId);
      await unlink();
      setIsUnlinkArmed(false);
      setFocusedTaskKey(null);
    } catch (error) {
      setUnlinkError(formatError(error));
    } finally {
      setIsUnlinking(false);
    }
  };

  if (focusedTask != null) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        {unlinkError != null ? (
          <p className={cn('shrink-0 pt-3 text-xs text-danger', PANE_RHYTHM.inset)}>
            {unlinkError}
          </p>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <FocusedTaskBody
            provider={provider}
            workspaceId={workspaceId}
            task={focusedTask}
            isConnected={connection.isConnected}
            headerActions={
              isUnlinkArmed ? (
                <InlineConfirm
                  role="danger"
                  className="max-w-sm"
                  icon={<Unlink size={12} aria-hidden />}
                  title={`Unlink ${focusedTask.identifier}?`}
                  description={`Removes the ${meta.label} issue from this session without changing the issue.`}
                  confirmLabel={`Unlink ${focusedTask.identifier}`}
                  autoDisarmMs={4000}
                  isBusy={isUnlinking}
                  onConfirm={() => handleUnlink({ task: focusedTask })}
                  onCancel={() => setIsUnlinkArmed(false)}
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  {tasks.length > 1 ? (
                    <GhostActionButton
                      icon={ArrowLeft}
                      label="All issues"
                      onClick={() => setFocusedTaskKey(null)}
                    />
                  ) : null}
                  <GhostActionButton
                    icon={Unlink}
                    tone="danger"
                    label="Unlink"
                    ariaLabel={`unlink ${focusedTask.identifier}`}
                    disabled={isUnlinking}
                    onClick={() => setIsUnlinkArmed(true)}
                  />
                  {linkAction}
                </div>
              )
            }
          />
        </div>
      </div>
    );
  }

  return (
    <PaneShell
      title={meta.label}
      description={`External ${meta.label} issues linked to this session.`}
      meta={hasTasks ? tasks.length : undefined}
      measure="reading"
      actions={connection.isConnected && hasTasks ? linkAction : undefined}
    >
      {!connection.isConnected ? (
        provider === 'github' ? (
          <GithubConnectionEmptyState
            workspaceId={workspaceId}
            hasGithubRemote={remoteKind === 'github'}
            compact
            onConnected={() => void githubConnection.refresh()}
          />
        ) : (
          <ConnectIntegrationEmptyState provider={provider} workspaceId={workspaceId} compact />
        )
      ) : null}
      {connection.isConnected && !hasTasks ? (
        <LensEmptyState
          icon={CONCEPT_ICONS.integrations}
          tone={CONCEPT_TONE.integrations}
          title={`No ${meta.label} issues linked`}
          description={`Search your assigned ${meta.label} issues or paste a URL to link one to this session.`}
          action={linkAction}
        />
      ) : null}
      {hasTasks ? (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={integrationTaskKey({ task })}>
              <IntegrationTaskCard
                task={task}
                providerLabel={meta.label}
                onSelect={() => setFocusedTaskKey(integrationTaskKey({ task }))}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {unlinkError != null ? <p className="text-xs text-danger">{unlinkError}</p> : null}
    </PaneShell>
  );
};

import { useMemo, useState } from 'react';
import { Unlink } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { Button, Divider, EmptyState, InlineConfirm } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { formatError } from '../../../../../../shared/lib/errors';
import { openUrl } from '../../../../../../shared/lib/editor';
import { ConnectIntegrationEmptyState } from '../../../../../integrations/ConnectIntegrationEmptyState';
import { ExternalTaskChip } from '../../../../../integrations/components/ExternalTaskChip';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { GithubConnectionEmptyState } from '../../../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../../../integrations/github/useGithubConnection';
import { useRemoteHostKind } from '../../../../../worktree/useRemoteHostKind';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { PaneShell } from '../PaneShell';
import { LinearTaskDetail } from './LinearTaskDetail';
import { LinkIssueForm } from './LinkIssueForm';
import { LinkTicketPopover } from './LinkTicketPopover';
import { SentryTaskDetail } from './SentryTaskDetail';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
};

type ProviderMeta = Readonly<{
  label: string;
}>;

type UnlinkParams = {
  readonly externalId: string;
  readonly mountWorkspaceId?: WorkspaceId;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: { label: 'Linear' },
  sentry: { label: 'Sentry' },
  gitlab: { label: 'GitLab' },
  github: { label: 'GitHub' },
};

export const IntegrationPane = ({ sessionId, workspaceId, provider }: Props) => {
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [unlinkingExternalId, setUnlinkingExternalId] = useState<string | null>(null);
  const [armedExternalId, setArmedExternalId] = useState<string | null>(null);
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

  const handleUnlink = async ({ externalId, mountWorkspaceId }: UnlinkParams) => {
    const taskKey = `${externalId}:${mountWorkspaceId ?? ''}`;
    setUnlinkError(null);
    setUnlinkingExternalId(taskKey);
    try {
      const unlink =
        mountWorkspaceId == null
          ? () => unlinkSessionExternalTask(sessionId, provider, externalId)
          : () => unlinkSessionExternalTask(sessionId, provider, externalId, mountWorkspaceId);
      await unlink();
      setArmedExternalId(null);
    } catch (error) {
      setUnlinkError(formatError(error));
    } finally {
      setUnlinkingExternalId(null);
    }
  };

  return (
    <PaneShell
      title={meta.label}
      description={`External ${meta.label} issues linked to this session.`}
      actions={
        connection.isConnected && hasTasks ? (
          <LinkTicketPopover
            sessionId={sessionId}
            workspaceId={workspaceId}
            provider={provider}
            providerLabel={meta.label}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
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
          <EmptyState
            icon={CONCEPT_ICONS.integrations}
            bordered
            className="px-6 py-8"
            title={`No ${meta.label} issues linked`}
            description={`Search your assigned ${meta.label} issues or paste a URL to link one to this session.`}
            action={
              <div className="flex w-full max-w-md flex-col gap-3 text-left">
                <LinkIssueForm
                  sessionId={sessionId}
                  workspaceId={workspaceId}
                  provider={provider}
                  providerLabel={meta.label}
                />
              </div>
            }
          />
        ) : null}
        {hasTasks ? (
          <div className="flex flex-col gap-5">
            {tasks.map((task, index) => {
              const taskKey = `${task.externalId}:${task.mountWorkspaceId ?? ''}`;
              return (
                <div key={taskKey} className="flex flex-col gap-5">
                  {index > 0 ? <Divider /> : null}
                  <div className="flex items-center gap-2">
                    <ExternalTaskChip
                      task={task}
                      appearance="row"
                      navigation="external"
                      ariaLabel={`open ${task.identifier}`}
                      onClick={() => void openUrl(task.url)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={unlinkingExternalId === taskKey}
                      aria-label={`unlink ${task.identifier}`}
                      onClick={() => setArmedExternalId(taskKey)}
                    >
                      <Unlink size={13} aria-hidden />
                      Unlink
                    </Button>
                  </div>
                  {armedExternalId === taskKey ? (
                    <InlineConfirm
                      role="danger"
                      icon={<Unlink size={12} aria-hidden />}
                      title={`Unlink ${task.identifier}?`}
                      description={`Removes the ${meta.label} issue from this session without changing the issue.`}
                      confirmLabel={`Unlink ${task.identifier}`}
                      autoDisarmMs={4000}
                      isBusy={unlinkingExternalId === taskKey}
                      onConfirm={() =>
                        handleUnlink({
                          externalId: task.externalId,
                          ...(task.mountWorkspaceId != null
                            ? { mountWorkspaceId: task.mountWorkspaceId }
                            : {}),
                        })
                      }
                      onCancel={() => setArmedExternalId(null)}
                    />
                  ) : null}
                  {connection.isConnected && provider === 'linear' ? (
                    <LinearTaskDetail workspaceId={workspaceId} issueId={task.externalId} />
                  ) : null}
                  {connection.isConnected && provider === 'sentry' ? (
                    <SentryTaskDetail workspaceId={workspaceId} task={task} />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
        {unlinkError != null ? <p className="text-xs text-danger">{unlinkError}</p> : null}
      </div>
    </PaneShell>
  );
};

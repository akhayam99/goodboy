import { useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, Link2, Unlink } from 'lucide-react';
import type {
  IsoDateTime,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { Button, Divider, InlineConfirm, Input } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { formatError } from '../../../../../../shared/lib/errors';
import { openUrl } from '../../../../../../shared/lib/editor';
import { ConnectIntegrationEmptyState } from '../../../../../integrations/ConnectIntegrationEmptyState';
import { IssuePicker } from '../../../../../integrations/components/IssuePicker';
import { useIssueCandidates } from '../../../../../integrations/hooks/useIssueCandidates';
import type { IssueCandidate } from '../../../../../integrations/fetchIssueCandidates';
import { resolveIntegrationConnection } from '../../../../../integrations/connection';
import { MissingGithubRemoteEmptyState } from '../../../../../github/components/MissingGithubRemoteEmptyState';
import { useRemoteHostKind } from '../../../../../worktree/useRemoteHostKind';
import { PaneShell } from '../PaneShell';
import { LinearTaskDetail } from './LinearTaskDetail';
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';
import { SentryTaskDetail } from './SentryTaskDetail';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
};

type ProviderMeta = Readonly<{
  label: string;
  studioEvent: string;
}>;

type UnlinkParams = {
  readonly externalId: string;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: { label: 'Linear', studioEvent: 'goodboy:open-linear-studio' },
  sentry: { label: 'Sentry', studioEvent: 'goodboy:open-sentry-studio' },
  gitlab: { label: 'GitLab', studioEvent: 'goodboy:open-gitlab-studio' },
  github: { label: 'GitHub', studioEvent: 'goodboy:open-github-studio' },
};

export const IntegrationPane = ({ sessionId, workspaceId, provider }: Props) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingExternalId, setUnlinkingExternalId] = useState<string | null>(null);
  const [armedExternalId, setArmedExternalId] = useState<string | null>(null);
  const externalTasks = useAppStore(
    (state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY,
  );
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const integrations = useAppStore(
    (state) => state.workspaceIntegrations[workspaceId] ?? EMPTY_ARRAY,
  );
  const remoteKind = useRemoteHostKind(workspaceId);
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
  });
  const candidates = useIssueCandidates({ workspaceId, provider });

  const handlePick = async (candidate: IssueCandidate) => {
    setError(null);
    setIsLinking(true);
    try {
      await linkSessionExternalTask(sessionId, {
        provider,
        externalId: candidate.externalId,
        identifier: candidate.identifier,
        title: candidate.title,
        url: candidate.url,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setIsLinking(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedTask = parseIntegrationTaskUrl({ provider, rawUrl: url });
    if (parsedTask == null) {
      setError('Paste an issue URL to link it.');
      return;
    }
    setError(null);
    setIsLinking(true);
    try {
      await linkSessionExternalTask(sessionId, {
        ...parsedTask,
        provider,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
      setUrl('');
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async ({ externalId }: UnlinkParams) => {
    setError(null);
    setUnlinkingExternalId(externalId);
    try {
      await unlinkSessionExternalTask(sessionId, provider, externalId);
      setArmedExternalId(null);
    } catch (unlinkError) {
      setError(formatError(unlinkError));
    } finally {
      setUnlinkingExternalId(null);
    }
  };

  return (
    <PaneShell
      title={meta.label}
      description={`External ${meta.label} issues linked to this session.`}
      width="3xl"
    >
      <div className="flex flex-col gap-3">
        {connection.isConnected ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${provider}-issue-url`}
                className="text-xs font-medium text-foreground"
              >
                Link an issue
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent(meta.studioEvent))}
              >
                Open {meta.label} studio
              </Button>
            </div>
            <IssuePicker
              rows={candidates.rows}
              isLoading={candidates.isLoading}
              isLoaded={candidates.isLoaded}
              error={candidates.error}
              value={null}
              placeholder={`Search ${meta.label} issues assigned to you…`}
              disabled={isLinking}
              onOpen={candidates.load}
              onPick={(candidate) => void handlePick(candidate)}
              onClear={() => undefined}
            />
            <div className="flex items-center gap-2">
              <Input
                id={`${provider}-issue-url`}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={`Or paste a ${meta.label} issue URL`}
                aria-label={`${meta.label} issue URL`}
              />
              <Button type="submit" size="sm" disabled={isLinking}>
                <Link2 size={13} aria-hidden />
                Link
              </Button>
            </div>
            {error != null ? <p className="text-xs text-danger">{error}</p> : null}
          </form>
        ) : provider === 'github' ? (
          <MissingGithubRemoteEmptyState compact />
        ) : (
          <ConnectIntegrationEmptyState provider={provider} compact />
        )}

        {tasks.length > 0 ? <Divider /> : null}
        <div className="flex flex-col gap-5">
          {tasks.map((task, index) => (
            <div key={task.externalId} className="flex flex-col gap-5">
              {index > 0 ? <Divider /> : null}
              <div className="flex items-center gap-3 rounded-lg bg-muted/35 p-3">
                <button
                  type="button"
                  onClick={() => void openUrl(task.url)}
                  aria-label={`open ${task.identifier}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
                    {task.identifier}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {task.title}
                  </span>
                  <ExternalLink size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={unlinkingExternalId === task.externalId}
                  aria-label={`unlink ${task.identifier}`}
                  onClick={() => setArmedExternalId(task.externalId)}
                >
                  <Unlink size={13} aria-hidden />
                  Unlink
                </Button>
              </div>
              {armedExternalId === task.externalId ? (
                <InlineConfirm
                  role="danger"
                  icon={<Unlink size={12} aria-hidden />}
                  title={`Unlink ${task.identifier}?`}
                  description={`Removes the ${meta.label} issue from this session without changing the issue.`}
                  confirmLabel={`Unlink ${task.identifier}`}
                  autoDisarmMs={4000}
                  isBusy={unlinkingExternalId === task.externalId}
                  onConfirm={() => handleUnlink({ externalId: task.externalId })}
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
          ))}
        </div>
      </div>
    </PaneShell>
  );
};

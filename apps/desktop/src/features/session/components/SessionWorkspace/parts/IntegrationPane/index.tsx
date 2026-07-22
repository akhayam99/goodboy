import { useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, Link2, Unlink } from 'lucide-react';
import type { IsoDateTime, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { Button, Input } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { formatError } from '../../../../../../shared/lib/errors';
import { openUrl } from '../../../../../../shared/lib/editor';
import { PaneShell } from '../PaneShell';
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';

type Props = {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
};

type ProviderMeta = Readonly<{
  label: string;
  studioEvent: string;
}>;

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: { label: 'Linear', studioEvent: 'goodboy:open-linear-studio' },
  sentry: { label: 'Sentry', studioEvent: 'goodboy:open-sentry-studio' },
  gitlab: { label: 'GitLab', studioEvent: 'goodboy:open-gitlab-studio' },
};

export const IntegrationPane = ({ sessionId, provider }: Props) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingExternalId, setUnlinkingExternalId] = useState<string | null>(null);
  const externalTasks = useAppStore(
    (state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY,
  );
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const tasks = useMemo(
    () => externalTasks.filter((task) => task.provider === provider),
    [externalTasks, provider],
  );
  const meta = PROVIDER_META[provider];

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

  return (
    <PaneShell
      title={meta.label}
      description={`External ${meta.label} issues linked to this session.`}
      width="3xl"
    >
      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {meta.label} issues linked yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <div
                key={task.externalId}
                className="flex items-center gap-3 rounded-lg bg-muted/35 p-3"
              >
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
                  onClick={() => {
                    setError(null);
                    setUnlinkingExternalId(task.externalId);
                    void unlinkSessionExternalTask(sessionId, provider, task.externalId)
                      .catch((unlinkError: unknown) => setError(formatError(unlinkError)))
                      .finally(() => setUnlinkingExternalId(null));
                  }}
                >
                  <Unlink size={13} aria-hidden />
                  Unlink
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
          <label htmlFor={`${provider}-issue-url`} className="text-xs font-medium text-foreground">
            Issue URL
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={`${provider}-issue-url`}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={`Paste a ${meta.label} issue URL`}
              aria-label={`${meta.label} issue URL`}
            />
            <Button type="submit" size="sm" disabled={isLinking}>
              <Link2 size={13} aria-hidden />
              Link
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent(meta.studioEvent))}
            >
              Open {meta.label} studio
            </Button>
          </div>
          {error != null ? <p className="text-xs text-danger">{error}</p> : null}
        </form>
      </div>
    </PaneShell>
  );
};

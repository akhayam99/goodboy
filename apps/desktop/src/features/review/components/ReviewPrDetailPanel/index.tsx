import { useEffect, useState } from 'react';
import { Button, Divider, EmptyState, ScrollFade, SectionHeader } from '@goodboy/ui';
import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  MessagesSquare,
  MousePointerClick,
} from 'lucide-react';
import type { ReviewablePr, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { formatError } from '../../../../shared/lib/errors';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { PullRequestChip } from '../../../github/components/PullRequestChip';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { AuthorAvatar } from '../AuthorAvatar';

type Props = {
  readonly pr: ReviewablePr | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const ReviewPrDetailPanel = ({ pr, workspaceId, onClose }: Props) => {
  const startPrReviewSession = useAppStore((s) => s.startPrReviewSession);
  const existingSessionId = useAppStore((s): SessionId | null => {
    if (pr == null) {
      return null;
    }
    const match = s.sessions.find((session) => {
      if (session.workspaceId !== workspaceId) {
        return false;
      }
      const tasks = s.sessionExternalTasks[session.id] ?? [];
      return tasks.some(
        (task) => task.provider === pr.provider && task.externalId === String(pr.number),
      );
    });
    return (match?.id as SessionId | undefined) ?? null;
  });
  const openSession = useOpenSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [pr?.id]);

  if (pr == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={MousePointerClick}
          title="No pull request selected"
          description="Pick a pull request to see its details and review it locally."
        />
      </div>
    );
  }

  const isGitlab = pr.provider === 'gitlab';
  const identifier = isGitlab ? `!${pr.number}` : `#${pr.number}`;
  const hostLabel = isGitlab ? 'GitLab' : 'GitHub';

  const reviewLocally = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sessionId = await startPrReviewSession(workspaceId, pr);
      openSession(sessionId, onClose);
    } catch (launchError) {
      setError(formatError(launchError));
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-8 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {identifier}
          </span>
          <PullRequestChip state={pr.isDraft ? 'draft' : pr.state} variant="badge" />
          {pr.reviewRequested ? (
            <span className="rounded-full bg-indigo-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 ring-1 ring-indigo-400/30">
              Review requested
            </span>
          ) : null}
          <span className="flex-1" />
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in {hostLabel} <ExternalLink size={11} aria-hidden />
          </a>
        </div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">{pr.title}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <AuthorAvatar author={pr.author} avatarUrl={pr.authorAvatarUrl} />
            <span className="font-medium text-foreground/80">{pr.author}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <GitBranch size={11} aria-hidden className="shrink-0" />
            <span className="truncate font-mono text-foreground/80">{pr.headBranch}</span>
            <span aria-hidden className="text-muted-foreground/50">
              into
            </span>
            <span className="truncate font-mono">{pr.baseBranch}</span>
          </span>
          <span>updated {formatRelativeDuration(pr.updatedAt)} ago</span>
        </div>
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1 justify-center">
        <ScrollFade
          className="h-full w-full max-w-3xl"
          viewportClassName="px-10 py-8"
          fadeSize={24}
        >
          <section className="flex flex-col gap-3">
            <SectionHeader label="review" />
            {pr.mine ? (
              <div className="rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5 text-sm text-muted-foreground">
                This is your pull request. Manage it from the Mine inbox.
              </div>
            ) : existingSessionId != null ? (
              <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-400/15">
                  <MessagesSquare size={15} className="text-indigo-500" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">
                    Review session already running
                  </span>
                  <span className="truncate text-2xs text-muted-foreground">
                    A local review session is linked to this pull request.
                  </span>
                </div>
                <OpenSessionButton
                  sessionId={existingSessionId}
                  onOpened={onClose}
                  label="Open review session"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-muted/10 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Review locally checks out the branch in an isolated worktree and starts a
                  read-only review agent. Draft comments stay local until you publish them.
                </p>
                <div className="flex items-center gap-3">
                  {error != null ? <span className="text-xs text-danger">{error}</span> : null}
                  <span className="flex-1" />
                  <Button variant="ghost" onClick={() => window.open(pr.url, '_blank')}>
                    Open in browser
                  </Button>
                  <Button onClick={() => void reviewLocally()} disabled={busy}>
                    {busy ? 'Starting review session…' : 'Review locally'}
                    {!busy ? <ArrowRight size={13} aria-hidden /> : null}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </ScrollFade>
      </div>
    </div>
  );
};

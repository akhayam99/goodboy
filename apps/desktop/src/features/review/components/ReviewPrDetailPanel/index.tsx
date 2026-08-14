import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useEffect, useState } from 'react';
import { Button, Chip, EmptyState, cn, tintClasses } from '@goodboy/ui';
import { ArrowRight, MessagesSquare } from 'lucide-react';
import type { ReviewablePr, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { formatError } from '../../../../shared/lib/errors';
import { PullRequestChip } from '../../../github/components/PullRequestChip';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { BranchPair } from '@goodboy/ui';
import { StudioWidget, HeaderBand } from '@goodboy/ui';
import { githubPullRequestFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { Avatar } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

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
        (task) =>
          task.provider === pr.provider &&
          task.externalId === String(pr.number) &&
          (task.mountWorkspaceId == null || task.mountWorkspaceId === pr.mountWorkspaceId),
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
          bordered
          tone={CONCEPT_TONE.pr}
          icon={CONCEPT_ICONS.pr}
          title="No pull request selected"
          description="Pick a pull request to see its details and review it locally."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const isGitlab = pr.provider === 'gitlab';
  const identifier = isGitlab ? `!${pr.number}` : `#${pr.number}`;
  const hostLabel = isGitlab ? 'GitLab' : 'GitHub';
  const infoTint = tintClasses('info');

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
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {identifier}
              </span>
              <PullRequestChip state={pr.isDraft ? 'draft' : pr.state} variant="badge" />
              {pr.reviewRequested ? <Chip tone="info" label="Review requested" /> : null}
              <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
                <Avatar url={pr.authorAvatarUrl} alt="" initialsSource={pr.author} size="xs" />
                <span className="font-medium text-foreground/80">{pr.author}</span>
              </span>
            </>
          }
          title={pr.title}
          subtitle={<BranchPair headBranch={pr.headBranch} baseBranch={pr.baseBranch} />}
          actions={
            <ExternalRefActions url={pr.url} label={`PR #${pr.number}`} hostLabel={hostLabel} />
          }
        />
      }
      properties={resolveDetailFields({ registry: githubPullRequestFields, entity: pr })}
    >
      <StudioWidget presentation="section" label="review">
        {pr.mine ? (
          <p className="text-sm text-muted-foreground">
            This is your pull request. Manage it from the Mine inbox.
          </p>
        ) : existingSessionId != null ? (
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                infoTint.bg,
              )}
            >
              <MessagesSquare size={15} className={infoTint.icon} aria-hidden />
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
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Review locally checks out the branch into a private local copy and starts a read-only
              review agent. Draft comments stay local until you publish them.
            </p>
            <div className="flex items-center gap-3">
              {error != null ? <span className="text-xs text-danger">{error}</span> : null}
              <span className="flex-1" />
              <Button onClick={() => void reviewLocally()} disabled={busy}>
                {busy ? 'Starting review session…' : 'Review locally'}
                {!busy ? <ArrowRight size={13} aria-hidden /> : null}
              </Button>
            </div>
          </div>
        )}
      </StudioWidget>
    </StudioDetailLayout>
  );
};

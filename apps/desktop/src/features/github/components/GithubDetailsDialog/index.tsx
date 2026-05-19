import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CircleSlash,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  MinusCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Dialog, cn } from '@kay-am/ui';
import type {
  PrCheckConclusion,
  PrCheckRun,
  PrComment,
  PrDetail,
  PrReview,
  PrReviewState,
  PullRequestState,
  SessionId,
} from '@kay-am/types';
import { useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';

type TabKey = 'ci' | 'reviews' | 'comments';

const NAV_ITEMS: ReadonlyArray<{ id: TabKey; label: string; icon: React.ElementType }> = [
  { id: 'ci', label: 'CI Checks', icon: CheckCheck },
  { id: 'reviews', label: 'Reviews', icon: MessageSquare },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
];

interface GithubDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: SessionId | null;
}

export function GithubDetailsDialog({ open, onClose, sessionId }: GithubDetailsDialogProps) {
  const github = useAppStore((s) => (sessionId ? s.sessionGithub[sessionId] : null));
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const [tab, setTab] = useState<TabKey>('ci');

  const pr = github?.pr ?? null;
  const detail = github?.detail ?? null;
  const detailLoading = !!github?.detailLoading;
  const detailError = github?.detailError ?? null;

  useEffect(() => {
    if (!open || !sessionId) return;
    if (!detail && !detailLoading && !detailError) {
      void refreshSessionPrDetail(sessionId);
    }
  }, [open, sessionId, detail, detailLoading, detailError, refreshSessionPrDetail]);

  if (!pr) {
    return (
      <Dialog open={open} onClose={onClose} title="GitHub" size="lg">
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          no pull request linked
        </p>
      </Dialog>
    );
  }

  const title = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-sm font-semibold">#{pr.number}</span>
      <span className="truncate text-sm font-normal text-muted-foreground" title={pr.title}>
        {pr.title}
      </span>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      fixedHeightClass="h-[600px]"
      bodyClassName="px-4 py-3"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <button
            type="button"
            onClick={() => void openUrl(pr.url)}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={12} aria-hidden />
            <span>open on github</span>
          </button>
          {sessionId && (
            <button
              type="button"
              onClick={() => void refreshSessionPrDetail(sessionId)}
              disabled={detailLoading}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw size={12} aria-hidden className={detailLoading ? 'animate-spin' : ''} />
              <span>refresh</span>
            </button>
          )}
        </div>
      }
    >
      <div className="flex h-full min-h-0 gap-3">
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const count = countFor(item.id, detail);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm transition-colors',
                  tab === item.id
                    ? 'bg-muted font-medium text-foreground before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon size={14} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {count !== null && (
                  <span className="rounded bg-background/60 px-1.5 py-0.5 text-2xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {detailLoading && !detail ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              <Loader2 size={14} aria-hidden className="mr-2 animate-spin" /> loading…
            </div>
          ) : detailError ? (
            <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {detailError}
            </div>
          ) : tab === 'ci' ? (
            <CiPane checks={detail?.checks ?? []} pr={pr} />
          ) : tab === 'reviews' ? (
            <ReviewsPane reviews={detail?.reviews ?? []} />
          ) : (
            <CommentsPane comments={detail?.comments ?? []} />
          )}
        </div>
      </div>
    </Dialog>
  );
}

function countFor(tab: TabKey, detail: PrDetail | null): number | null {
  if (!detail) return null;
  if (tab === 'ci') return detail.checks.length;
  if (tab === 'reviews') return detail.reviews.length;
  return detail.comments.length;
}

// --- CI ---

const CHECK_ICON: Record<PrCheckConclusion, { icon: React.ElementType; className: string }> = {
  success: { icon: Check, className: 'text-success' },
  failure: { icon: XCircle, className: 'text-danger' },
  neutral: { icon: MinusCircle, className: 'text-muted-foreground' },
  cancelled: { icon: CircleSlash, className: 'text-muted-foreground' },
  timed_out: { icon: XCircle, className: 'text-danger' },
  action_required: { icon: AlertCircle, className: 'text-warning' },
  stale: { icon: AlertCircle, className: 'text-muted-foreground' },
  skipped: { icon: MinusCircle, className: 'text-muted-foreground' },
  pending: { icon: Clock, className: 'text-warning' },
  unknown: { icon: AlertCircle, className: 'text-muted-foreground' },
};

function CiPane({ checks, pr }: { checks: ReadonlyArray<PrCheckRun>; pr: PullRequestState }) {
  if (checks.length === 0) {
    return (
      <EmptyState
        icon={pr.checks === 'pending' ? Clock : MinusCircle}
        text={pr.checks === 'pending' ? 'ci is queued' : 'no ci checks yet'}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {checks.map((c) => {
        const entry = CHECK_ICON[c.conclusion];
        const Icon = entry.icon;
        return (
          <li key={c.name}>
            <button
              type="button"
              onClick={c.detailsUrl ? () => void openUrl(c.detailsUrl as string) : undefined}
              disabled={!c.detailsUrl}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <Icon size={13} aria-hidden className={cn('shrink-0', entry.className)} />
              <span className="min-w-0 flex-1 truncate font-mono">{c.name}</span>
              <span className="shrink-0 text-2xs uppercase tracking-wider text-muted-foreground">
                {c.conclusion.replace('_', ' ')}
              </span>
              {c.durationMs != null && (
                <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
                  {formatDuration(c.durationMs)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Reviews ---

const REVIEW_CHIP: Record<PrReviewState, { className: string; label: string }> = {
  approved: { className: 'bg-success/15 text-success', label: 'approved' },
  changes_requested: { className: 'bg-danger/15 text-danger', label: 'changes requested' },
  commented: { className: 'bg-muted text-muted-foreground', label: 'commented' },
  dismissed: { className: 'bg-muted/60 text-muted-foreground/60', label: 'dismissed' },
  pending: { className: 'bg-warning/15 text-warning', label: 'pending' },
};

function ReviewsPane({ reviews }: { reviews: ReadonlyArray<PrReview> }) {
  if (reviews.length === 0) {
    return <EmptyState icon={MessageSquare} text="no reviews yet" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {reviews.map((r) => {
        const chip = REVIEW_CHIP[r.state];
        return (
          <li key={r.id} className="rounded-md border border-border-soft px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{r.author}</span>
              <span className={cn('rounded px-1.5 py-0.5 text-2xs font-medium', chip.className)}>
                {chip.label}
              </span>
              {r.submittedAt && (
                <span className="ml-auto text-2xs text-muted-foreground/60">
                  {formatDate(r.submittedAt)}
                </span>
              )}
            </div>
            {r.body && (
              <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{r.body}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- Comments ---

function CommentsPane({ comments }: { comments: ReadonlyArray<PrComment> }) {
  const grouped = useMemo(() => {
    const open = comments.filter((c) => c.source !== 'review' || c.resolved === false);
    const resolved = comments.filter((c) => c.source === 'review' && c.resolved === true);
    return { open, resolved };
  }, [comments]);

  if (comments.length === 0) {
    return <EmptyState icon={MessageSquare} text="no comments yet" />;
  }
  return (
    <div className="flex flex-col gap-3">
      {grouped.open.length > 0 && <CommentList title="Open" items={grouped.open} />}
      {grouped.resolved.length > 0 && (
        <CommentList title="Resolved" items={grouped.resolved} dimmed />
      )}
    </div>
  );
}

function CommentList({
  title,
  items,
  dimmed,
}: {
  title: string;
  items: ReadonlyArray<PrComment>;
  dimmed?: boolean;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title} <span className="tabular-nums">({items.length})</span>
      </h3>
      <ul className={cn('flex flex-col gap-2', dimmed && 'opacity-60')}>
        {items.map((c) => (
          <li key={c.id} className="rounded-md border border-border-soft px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{c.author}</span>
              {c.source === 'review' && c.path && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                  {c.path}
                  {c.line ? `:${c.line}` : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => void openUrl(c.url)}
                className="ml-auto text-muted-foreground/60 hover:text-foreground"
                title="open on github"
                aria-label="open comment on github"
              >
                <ExternalLink size={11} aria-hidden />
              </button>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">{c.body}</p>
            <span className="mt-1 block text-2xs text-muted-foreground/50">
              {formatDate(c.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- helpers ---

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon size={20} aria-hidden />
      <span className="text-xs">{text}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

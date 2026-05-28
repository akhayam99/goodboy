import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Clock,
  ExternalLink,
  FileCode2,
  Filter,
  ListChecks,
  Loader2,
  MessageSquare,
  MessageSquareReply,
  MinusCircle,
  RefreshCw,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Dialog, Markdown, cn } from '@goodboy/ui';
import type {
  PrCheckConclusion,
  PrCheckRun,
  PrComment,
  PrDetail,
  PrReview,
  PrReviewState,
  PullRequestState,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { buildCommentAgentArgs } from '../../../chat/spawn-from-comment';
import { type CommentThread, groupThreads, isBot, threadPriority } from '../../comment-threads';

type TabKey = 'ci' | 'reviews' | 'comments';

const NAV_ITEMS: ReadonlyArray<{ id: TabKey; label: string; icon: React.ElementType }> = [
  { id: 'ci', label: 'CI Checks', icon: ListChecks },
  { id: 'reviews', label: 'Reviews', icon: UserCheck },
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
      fixedHeightClass="h-[min(85vh,820px)]"
      className="w-[min(1180px,94vw)] max-w-[1180px]"
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
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto pr-3">
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
        <div
          aria-hidden
          className="my-1 w-px shrink-0 bg-gradient-to-b from-transparent via-border-soft via-30% to-transparent"
        />
        <div
          className="min-w-0 flex-1 overflow-y-auto pl-1 pr-3"
          style={{ scrollbarGutter: 'stable' }}
        >
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
            <CommentsPane
              comments={detail?.comments ?? []}
              pr={pr}
              sessionId={sessionId}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}

function countFor(tab: TabKey, detail: PrDetail | null): number | null {
  if (!detail) return null;
  if (tab === 'ci') return detail.checks.length;
  // Both reviews and comments tabs collapse their raw lists before render
  // (latest-per-author for reviews, one-per-thread for comments). Mirror
  // those collapses in the nav badge so the count matches what the user
  // will actually see when they open the tab.
  if (tab === 'reviews') {
    const seenAuthor = new Set<string>();
    for (const r of detail.reviews) seenAuthor.add(r.author);
    return seenAuthor.size;
  }
  const seenThread = new Set<string>();
  for (const c of detail.comments) {
    if (c.source !== 'review') continue;
    const tid = c.threadId ?? c.id;
    seenThread.add(tid);
  }
  return seenThread.size;
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

const CHECK_CHIP: Record<PrCheckConclusion, string> = {
  success: 'bg-success/15 text-success',
  failure: 'bg-danger/15 text-danger',
  timed_out: 'bg-danger/15 text-danger',
  pending: 'bg-warning/15 text-warning',
  action_required: 'bg-warning/15 text-warning',
  neutral: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  stale: 'bg-muted text-muted-foreground',
  skipped: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
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
    <ul className="flex flex-col gap-1">
      {checks.map((c) => {
        const entry = CHECK_ICON[c.conclusion];
        const Icon = entry.icon;
        return (
          <li key={c.name}>
            <button
              type="button"
              onClick={c.detailsUrl ? () => void openUrl(c.detailsUrl as string) : undefined}
              disabled={!c.detailsUrl}
              className="flex w-full items-center gap-2 rounded-md border border-border-soft bg-muted/30 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-muted/30"
            >
              <Icon size={13} aria-hidden className={cn('shrink-0', entry.className)} />
              <span className="min-w-0 flex-1 truncate font-mono">{c.name}</span>
              {c.durationMs != null && (
                <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
                  {formatDuration(c.durationMs)}
                </span>
              )}
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                  CHECK_CHIP[c.conclusion],
                )}
              >
                {c.conclusion.replace('_', ' ')}
              </span>
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

/**
 * Dedup the review list down to the latest entry per author. github keeps
 * every review event (commented → changes_requested → approved …) but for
 * a snapshot view only the reviewer's most recent stance matters; the
 * scrolling history of approvals/comments is noise on a panel this small.
 */
// Order reviewers float in the list by stance: approvers first (lowest
// friction), then change-requesters (highest signal), then commenters,
// then the soft states. Within a group, newest first.
const REVIEW_STATE_PRIORITY: Record<PrReviewState, number> = {
  approved: 0,
  changes_requested: 1,
  commented: 2,
  dismissed: 3,
  pending: 4,
};

function latestReviewsByAuthor(reviews: ReadonlyArray<PrReview>): ReadonlyArray<PrReview> {
  const latest = new Map<string, PrReview>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    latest.set(r.author, r);
  }
  return [...latest.values()].sort((a, b) => {
    const p = REVIEW_STATE_PRIORITY[a.state] - REVIEW_STATE_PRIORITY[b.state];
    if (p !== 0) return p;
    return (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '');
  });
}

function ReviewsPane({ reviews }: { reviews: ReadonlyArray<PrReview> }) {
  const latest = useMemo(() => latestReviewsByAuthor(reviews), [reviews]);
  if (latest.length === 0) {
    return <EmptyState icon={UserCheck} text="no reviews yet" />;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {latest.map((r) => {
        const chip = REVIEW_CHIP[r.state];
        const body = r.body.trim();
        const bot = isBot(r.author);
        return (
          <li key={r.id} className="rounded-md border border-border-soft bg-muted/30 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-foreground">{r.author}</span>
              {bot ? (
                <span className="rounded bg-info/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-info">
                  bot
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                  chip.className,
                )}
              >
                {chip.label}
              </span>
              {r.submittedAt && (
                <span className="ml-auto text-2xs text-muted-foreground/60">
                  {formatRelative(Date.now() - new Date(r.submittedAt).getTime())}
                </span>
              )}
            </div>
            {body && (
              <div className="mt-1.5 text-foreground/85 [overflow-wrap:anywhere] [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
                <Markdown text={body} className="text-xs leading-relaxed" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- Comments ---

type ThreadStatus = 'open-review' | 'issue' | 'resolved';

function threadStatus(t: CommentThread): ThreadStatus {
  if (t.head.source === 'review') return t.head.resolved ? 'resolved' : 'open-review';
  return 'issue';
}

interface CommentsPaneProps {
  comments: ReadonlyArray<PrComment>;
  pr: PullRequestState;
  sessionId: SessionId | null;
  onClose: () => void;
}

function CommentsPane({ comments, pr, sessionId, onClose }: CommentsPaneProps) {
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const [filterNeedsResolve, setFilterNeedsResolve] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Only review threads (the ones with a 'resolve conversation' affordance
  // on github) make sense in this tab. Plain issue comments don't carry a
  // thread id and can't be resolved from here, they belong on github proper.
  const threads = useMemo(
    () => groupThreads(comments).filter((t) => t.head.source === 'review'),
    [comments],
  );

  const counts = useMemo(() => {
    let open = 0;
    let resolved = 0;
    for (const t of threads) {
      const s = threadStatus(t);
      if (s === 'open-review') open += 1;
      else if (s === 'resolved') resolved += 1;
    }
    return { open, resolved };
  }, [threads]);

  const visible = useMemo(() => {
    const pred = (t: CommentThread): boolean => {
      const s = threadStatus(t);
      if (filterNeedsResolve) return s === 'open-review';
      if (s === 'resolved') return showResolved;
      return true;
    };
    return [...threads].filter(pred).sort((a, b) => {
      const p = threadPriority(a) - threadPriority(b);
      if (p !== 0) return p;
      return b.head.createdAt.localeCompare(a.head.createdAt);
    });
  }, [threads, filterNeedsResolve, showResolved]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleResolve = useCallback(
    async (c: PrComment) => {
      if (!sessionId || resolvingId !== null) return;
      setResolvingId(c.id);
      try {
        const args = buildCommentAgentArgs(c, pr);
        const agentId = await spawnAgent(sessionId, {
          name: args.name,
          model: args.model,
          effort: args.effort,
          initialPrompt: args.initialPrompt,
          kindOverride: args.kind,
        });
        await selectAgent(sessionId, agentId);
        onClose();
      } finally {
        setResolvingId(null);
      }
    },
    [sessionId, resolvingId, pr, spawnAgent, selectAgent, onClose],
  );

  if (comments.length === 0) {
    return <EmptyState icon={MessageSquare} text="no comments yet" />;
  }

  const allResolved = counts.open === 0 && counts.resolved > 0;

  return (
    <div className="flex h-full flex-col gap-2.5">
      <CommentsHeader
        counts={counts}
        filterActive={filterNeedsResolve}
        onToggleFilter={() => setFilterNeedsResolve((v) => !v)}
      />
      {visible.length === 0 ? (
        allResolved && !showResolved ? (
          <AllResolvedRow count={counts.resolved} onShow={() => setShowResolved(true)} />
        ) : filterNeedsResolve ? (
          <FilterEmptyRow onClear={() => setFilterNeedsResolve(false)} />
        ) : null
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((t) => (
            <li key={t.head.id}>
              <CommentThreadCard
                thread={t}
                expanded={expanded.has(t.head.id)}
                onToggle={() => toggleExpand(t.head.id)}
                onResolve={sessionId ? () => void handleResolve(t.head) : undefined}
                resolving={resolvingId === t.head.id}
              />
            </li>
          ))}
        </ul>
      )}
      {!filterNeedsResolve && counts.resolved > 0 && !allResolved ? (
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="inline-flex w-fit items-center gap-1 self-start rounded text-2xs text-muted-foreground/80 hover:text-foreground"
        >
          <ChevronRight
            size={10}
            aria-hidden
            className={cn('transition-transform', showResolved && 'rotate-90')}
          />
          {showResolved ? `hide ${counts.resolved} resolved` : `show ${counts.resolved} resolved`}
        </button>
      ) : null}
    </div>
  );
}

function CommentsHeader({
  counts,
  filterActive,
  onToggleFilter,
}: {
  counts: { open: number; resolved: number };
  filterActive: boolean;
  onToggleFilter: () => void;
}) {
  const totalActionable = counts.open;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border-soft pb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <CountChip
          tone={totalActionable > 0 ? 'warning' : 'muted'}
          label="needs resolve"
          count={counts.open}
        />
        {counts.resolved > 0 ? (
          <CountChip tone="success" label="resolved" count={counts.resolved} />
        ) : null}
      </div>
      {counts.open > 0 || filterActive ? (
        <button
          type="button"
          onClick={onToggleFilter}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors',
            filterActive
              ? 'border-warning/50 bg-warning/15 text-warning'
              : 'border-border-soft text-muted-foreground hover:border-border hover:text-foreground',
          )}
          aria-pressed={filterActive}
          title="show only review comments that still need a fix"
        >
          <Filter size={10} aria-hidden />
          needs resolve
        </button>
      ) : null}
    </div>
  );
}

function CountChip({
  tone,
  label,
  count,
}: {
  tone: 'warning' | 'muted' | 'success';
  label: string;
  count: number;
}) {
  const toneClass =
    tone === 'warning'
      ? 'bg-warning/10 text-warning'
      : tone === 'success'
        ? 'bg-success/10 text-success'
        : 'bg-muted/50 text-muted-foreground';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
        toneClass,
      )}
    >
      <span className="tabular-nums">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function AllResolvedRow({ count, onShow }: { count: number; onShow: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-4 py-6 text-center">
      <CheckCheck size={18} aria-hidden className="text-success" />
      <span className="text-xs font-medium text-foreground">all review comments resolved</span>
      <button
        type="button"
        onClick={onShow}
        className="text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        show {count} resolved
      </button>
    </div>
  );
}

function FilterEmptyRow({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-border-soft bg-subtle/40 px-4 py-6 text-center">
      <Filter size={16} aria-hidden className="text-muted-foreground" />
      <span className="text-xs text-muted-foreground">no open review comments</span>
      <button
        type="button"
        onClick={onClear}
        className="text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        clear filter
      </button>
    </div>
  );
}

interface CommentThreadCardProps {
  thread: CommentThread;
  expanded: boolean;
  onToggle: () => void;
  onResolve?: () => void;
  resolving: boolean;
}

function CommentThreadCard({
  thread,
  expanded,
  onToggle,
  onResolve,
  resolving,
}: CommentThreadCardProps) {
  const { head, replies } = thread;
  const status = threadStatus(thread);
  const bot = isBot(head.author);
  const showResolveButton = status === 'open-review' && onResolve;

  return (
    <article
      className={cn(
        'group rounded-md border bg-muted/30 px-2.5 py-2 transition-colors',
        status === 'open-review' && 'border-warning/30 hover:border-warning/50',
        status === 'resolved' && 'border-border-soft opacity-70',
      )}
    >
      <header className="flex items-center gap-2">
        <StatusDot status={status} />
        <Avatar url={head.authorAvatarUrl} alt={head.author} />
        <span className="truncate text-xs font-semibold text-foreground">{head.author}</span>
        {bot ? (
          <span className="rounded bg-info/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-info">
            bot
          </span>
        ) : null}
        <span className="text-2xs text-muted-foreground/60">
          {formatRelative(Date.now() - new Date(head.createdAt).getTime())}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {showResolveButton ? (
            <button
              type="button"
              onClick={onResolve}
              disabled={resolving}
              title="spawn an implementer agent to address this comment"
              aria-label="resolve this comment"
              className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/5 px-1.5 py-0.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resolving ? (
                <Loader2 size={10} aria-hidden className="animate-spin" />
              ) : (
                <Sparkles size={10} aria-hidden />
              )}
              resolve
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void openUrl(head.url)}
            title="open comment on github"
            aria-label="open comment on github"
            className="rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={10} aria-hidden />
          </button>
        </div>
      </header>
      {head.path ? (
        <button
          type="button"
          onClick={() => void openUrl(head.url)}
          title={`${head.path}${head.line ? ':' + head.line : ''}, open on github`}
          className="mt-1 inline-flex items-center gap-1 self-start rounded bg-muted/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <FileCode2 size={9} aria-hidden />
          <span className="truncate">
            {head.path}
            {head.line ? `:${head.line}` : ''}
          </span>
        </button>
      ) : null}
      <CommentBody body={head.body} expanded={expanded} onToggle={onToggle} />
      {replies.length > 0 ? (
        <RepliesBlock replies={replies} expanded={expanded} onToggle={onToggle} />
      ) : null}
    </article>
  );
}

interface CommentBodyProps {
  body: string;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Comment body renderer. Collapsed → plain-text snippet clipped to two lines
 * (a button: click to expand, no markdown noise). Expanded → full markdown so
 * the prose, code fences, lists, and inline links the user wrote on github
 * actually read like the original. The toggle button moves to a small
 * 'show less' affordance so links inside the markdown stay clickable without
 * accidentally collapsing the card.
 */
function CommentBody({ body, expanded, onToggle }: CommentBodyProps) {
  const trimmed = body.trim();
  if (!trimmed) {
    return <p className="mt-1.5 text-xs italic text-muted-foreground/70">(empty)</p>;
  }
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="expand"
        className="mt-1.5 block w-full whitespace-pre-wrap break-words text-left text-xs text-foreground/85 transition-colors line-clamp-2 hover:text-foreground"
      >
        {trimmed}
      </button>
    );
  }
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div className="text-foreground/90 [overflow-wrap:anywhere] [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
        <Markdown text={trimmed} className="text-[13px] leading-relaxed" />
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 self-start text-2xs text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <ChevronDown size={9} aria-hidden className="rotate-180" />
        show less
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: ThreadStatus }) {
  if (status === 'resolved') {
    return <CheckCheck size={11} aria-hidden className="shrink-0 text-success" />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-2 w-2 shrink-0 rounded-full',
        status === 'open-review' ? 'bg-warning' : 'bg-muted-foreground/50',
      )}
      title={status === 'open-review' ? 'open review comment' : 'general comment'}
    />
  );
}

function RepliesBlock({
  replies,
  expanded,
  onToggle,
}: {
  replies: ReadonlyArray<PrComment>;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="mt-1.5 inline-flex items-center gap-1 self-start rounded text-2xs text-muted-foreground/80 hover:text-foreground"
      >
        <MessageSquareReply size={10} aria-hidden />
        <span>
          {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
        </span>
        <ChevronDown size={9} aria-hidden />
      </button>
    );
  }
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5 border-l border-border-soft pl-2.5">
      {replies.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Avatar url={r.authorAvatarUrl} alt={r.author} />
            <span className="text-2xs font-medium text-foreground">{r.author}</span>
            {isBot(r.author) ? (
              <span className="rounded bg-info/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-info">
                bot
              </span>
            ) : null}
            <span className="text-2xs text-muted-foreground/60">
              {formatRelative(Date.now() - new Date(r.createdAt).getTime())}
            </span>
          </div>
          {r.body.trim() ? (
            <div className="text-foreground/85 [overflow-wrap:anywhere] [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
              <Markdown text={r.body.trim()} className="text-xs leading-relaxed" />
            </div>
          ) : (
            <span className="text-xs italic text-muted-foreground/70">(empty)</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground"
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-4 w-4 shrink-0 rounded-full" loading="lazy" />;
}

function formatRelative(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const s = Math.round(ms / 1_000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
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

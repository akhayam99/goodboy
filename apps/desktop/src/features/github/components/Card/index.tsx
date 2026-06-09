import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNow } from '../../../../shared/hooks/useNow';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  MinusCircle,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { cn, Markdown } from '@goodboy/ui';
import type {
  PrCheckConclusion,
  PrCheckRun,
  PrComment,
  PrDetail,
  PrReview,
  PrReviewRequest,
  PrReviewState,
  PullRequestState,
} from '@goodboy/types';
import { type CommentThread, groupThreads, isBot, threadPriority } from '../../comment-threads';

const TAB_KEYS = ['ci', 'comments', 'review'] as const;
export type GithubTabKey = (typeof TAB_KEYS)[number];

const TAB_LABEL: Record<GithubTabKey, string> = {
  ci: 'CI',
  comments: 'Comments',
  review: 'Review',
};

const TAB_ICON_BTN =
  'rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

type Props = {
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly detailFetchedAt: string | null;
  readonly branchLastActivity: string | null;
  readonly onOpenUrl: (url: string) => void;
  readonly onRefresh: () => void;
  readonly onSpawnFromComment?: (comment: PrComment) => void;
  readonly onSpawnFromReviewChanges?: () => void;
};

export function GithubCard({
  pr,
  detail,
  detailLoading,
  detailError,
  detailFetchedAt,
  branchLastActivity,
  onOpenUrl,
  onRefresh,
  onSpawnFromComment,
  onSpawnFromReviewChanges,
}: Props) {
  const smartDefault = useMemo(
    () => pickSmartTab(pr, detail, branchLastActivity),
    [pr, detail, branchLastActivity],
  );
  const [active, setActive] = useState<GithubTabKey>(smartDefault);
  const [userSelectedPr, setUserSelectedPr] = useState<number | null>(null);
  const isUserPick = userSelectedPr === pr.number;

  useEffect(() => {
    if (!isUserPick) setActive(smartDefault);
  }, [smartDefault, isUserPick]);

  const selectTab = (k: GithubTabKey) => {
    setUserSelectedPr(pr.number);
    setActive(k);
  };

  const tabStatus = useMemo(() => computeTabStatus(pr, detail), [pr, detail]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span
          className="inline-flex rounded border border-border-soft bg-subtle"
          role="tablist"
          aria-label="GitHub card view"
        >
          {TAB_KEYS.map((k) => {
            const isActive = k === active;
            const status = tabStatus[k];
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(k)}
                title={status?.label}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-2xs transition-colors first:rounded-l last:rounded-r',
                  isActive
                    ? 'bg-background font-semibold text-foreground shadow-sm'
                    : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                <span>{TAB_LABEL[k]}</span>
                {status ? <TabBadge status={status} dim={!isActive} /> : null}
              </button>
            );
          })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <StaleCaption fetchedAt={detailFetchedAt} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={detailLoading}
            title="refresh GitHub data"
            aria-label="refresh GitHub data"
            className={cn(TAB_ICON_BTN, 'disabled:opacity-40')}
          >
            <RefreshCw size={10} className={cn(detailLoading && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatedTabBody activeKey={active}>
        {detailError ? (
          <ErrorRow message={detailError} onRetry={onRefresh} />
        ) : detailLoading && !detail ? (
          <DetailSkeleton />
        ) : active === 'ci' ? (
          <CiPane checks={detail?.checks ?? []} pr={pr} onOpenUrl={onOpenUrl} />
        ) : active === 'comments' ? (
          <CommentsPane
            comments={detail?.comments ?? []}
            pr={pr}
            onOpenUrl={onOpenUrl}
            onSpawnFromComment={onSpawnFromComment}
          />
        ) : (
          <ReviewPane
            reviews={detail?.reviews ?? []}
            requests={detail?.reviewRequests ?? []}
            pr={pr}
            onOpenUrl={onOpenUrl}
            onSpawnFromReviewChanges={onSpawnFromReviewChanges}
          />
        )}
      </AnimatedTabBody>
    </div>
  );
}

function AnimatedTabBody({ activeKey, children }: { activeKey: string; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (h != null) setHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeKey]);

  return (
    <div
      className="overflow-hidden rounded-md border border-border-soft bg-subtle transition-[height] duration-200 ease-out motion-reduce:transition-none"
      style={height != null ? { height } : undefined}
    >
      <div ref={innerRef} key={activeKey} className="min-h-16 max-h-48 overflow-y-auto px-2.5 py-2">
        {children}
      </div>
    </div>
  );
}

export type TabStatus = {
  readonly tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  readonly icon: ReactNode;
  readonly count?: number;
  readonly label: string;
};

const TONE_PILL: Record<TabStatus['tone'], string> = {
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted text-muted-foreground',
};

export function TabBadge({ status, dim }: { status: TabStatus; dim: boolean }) {
  const hasCount = status.count != null && status.count > 0;
  return (
    <span
      aria-label={status.label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1 leading-none transition-opacity',
        TONE_PILL[status.tone],
        dim && 'opacity-80',
      )}
    >
      {status.icon}
      {hasCount ? (
        <span className="text-[9px] font-semibold tabular-nums">{status.count}</span>
      ) : null}
    </span>
  );
}

export function computeTabStatus(
  pr: PullRequestState,
  detail: PrDetail | null,
): Record<GithubTabKey, TabStatus | null> {
  return {
    ci: computeCiStatus(pr, detail?.checks ?? []),
    comments: computeCommentsStatus(detail?.comments ?? []),
    review: computeReviewStatus(pr, detail?.reviews ?? [], detail?.reviewRequests ?? []),
  };
}

function computeCiStatus(
  pr: PullRequestState,
  checks: ReadonlyArray<PrCheckRun>,
): TabStatus | null {
  if (checks.length === 0) {
    if (pr.checks === 'failure')
      return { tone: 'danger', icon: <XCircle size={9} aria-hidden />, label: 'ci failing' };
    if (pr.checks === 'pending')
      return {
        tone: 'warning',
        icon: <Clock size={9} aria-hidden className="motion-safe:animate-pulse" />,
        label: 'ci running',
      };
    if (pr.checks === 'success')
      return { tone: 'success', icon: <Check size={9} aria-hidden />, label: 'ci passing' };
    return null;
  }
  const fail = checks.filter(
    (c) =>
      c.conclusion === 'failure' ||
      c.conclusion === 'cancelled' ||
      c.conclusion === 'timed_out' ||
      c.conclusion === 'action_required',
  ).length;
  const pending = checks.filter((c) => c.conclusion === 'pending').length;
  if (fail > 0)
    return {
      tone: 'danger',
      icon: <XCircle size={9} aria-hidden />,
      count: fail,
      label: `${fail} failing check${fail === 1 ? '' : 's'}`,
    };
  if (pending > 0)
    return {
      tone: 'warning',
      icon: <Clock size={9} aria-hidden className="motion-safe:animate-pulse" />,
      count: pending,
      label: `${pending} check${pending === 1 ? '' : 's'} running`,
    };
  return { tone: 'success', icon: <Check size={9} aria-hidden />, label: 'all checks passing' };
}

function computeCommentsStatus(comments: ReadonlyArray<PrComment>): TabStatus | null {
  const heads = groupThreads(comments)
    .map((t) => t.head)
    .filter((c) => c.source === 'review');
  if (heads.length === 0) return null;
  const open = heads.filter((c) => c.resolved === false).length;
  if (open > 0)
    return {
      tone: 'warning',
      icon: <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />,
      count: open,
      label: `${open} unresolved comment${open === 1 ? '' : 's'}`,
    };
  return {
    tone: 'success',
    icon: <CheckCheck size={9} aria-hidden />,
    label: 'all comments resolved',
  };
}

function computeReviewStatus(
  pr: PullRequestState,
  reviews: ReadonlyArray<PrReview>,
  requests: ReadonlyArray<PrReviewRequest>,
): TabStatus | null {
  const latest = latestTerminalReviewsByAuthor(reviews);
  const changes = latest.filter((r) => r.state === 'changes_requested');
  if (changes.length > 0)
    return {
      tone: 'danger',
      icon: <AlertCircle size={9} aria-hidden />,
      count: changes.length,
      label: `changes requested by ${changes.map((r) => r.author).join(', ')}`,
    };
  const approvals = latest.filter((r) => r.state === 'approved');
  if (pr.reviewDecision === 'approved' || approvals.length > 0)
    return {
      tone: 'success',
      icon: <CheckCheck size={9} aria-hidden />,
      label:
        approvals.length > 0
          ? `approved by ${approvals.map((r) => r.author).join(', ')}`
          : 'approved',
    };
  if (requests.length > 0)
    return {
      tone: 'info',
      icon: <CircleDashed size={9} aria-hidden />,
      count: requests.length,
      label: `awaiting ${requests.length} reviewer${requests.length === 1 ? '' : 's'}`,
    };
  if (reviews.some((r) => r.state === 'commented'))
    return {
      tone: 'muted',
      icon: <MessageSquare size={9} aria-hidden />,
      label: 'reviewer commented',
    };
  return null;
}

function StaleCaption({ fetchedAt }: { fetchedAt: string | null }) {
  // Shared 30s ticker, one timer total even with many PR cards on screen.
  const now = useNow(30_000, !!fetchedAt);
  if (!fetchedAt) return null;
  const ageMs = now - new Date(fetchedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 60_000) return null;
  return (
    <span
      className="text-[9px] text-muted-foreground/60"
      title={`fetched at ${new Date(fetchedAt).toLocaleString()}`}
    >
      updated {formatRelative(ageMs)}
    </span>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-danger">
      <AlertCircle size={11} aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={message}>
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        title="retry"
        aria-label="retry"
        className={TAB_ICON_BTN}
      >
        <RefreshCw size={10} aria-hidden />
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-label="loading pr data">
      <div className="h-2.5 w-3/4 animate-pulse rounded bg-muted [animation-delay:0ms]" />
      <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted [animation-delay:120ms]" />
      <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted [animation-delay:240ms]" />
    </div>
  );
}

export function CiPane({
  checks,
  pr,
  onOpenUrl,
}: {
  checks: ReadonlyArray<PrCheckRun>;
  pr: PullRequestState;
  onOpenUrl: (url: string) => void;
}) {
  if (checks.length === 0) {
    return (
      <EmptyRow
        text="No CI runs yet"
        actionUrl={pr.url}
        actionLabel="view on GitHub"
        onOpenUrl={onOpenUrl}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {checks.map((c, idx) => (
        <li key={`${c.name}-${idx}`}>
          <button
            type="button"
            onClick={() => (c.detailsUrl ? onOpenUrl(c.detailsUrl) : onOpenUrl(pr.url))}
            className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-left hover:bg-background"
            title={c.detailsUrl ?? c.name}
          >
            <CheckConclusionIcon conclusion={c.conclusion} />
            <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">
              {formatDuration(c.durationMs)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const COMMENT_DISPLAY_LIMIT = 5;

export function CommentsPane({
  comments,
  pr,
  onOpenUrl,
  onSpawnFromComment,
}: {
  comments: ReadonlyArray<PrComment>;
  pr: PullRequestState;
  onOpenUrl: (url: string) => void;
  onSpawnFromComment?: (c: PrComment) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const allThreads = useMemo(() => groupThreads(comments), [comments]);

  // Only review threads are resolvable / actionable. General issue-comments
  // (no path, no resolved state) are filtered out, they live "view on github".
  const reviewThreads = useMemo(
    () => allThreads.filter((t) => t.head.source === 'review'),
    [allThreads],
  );
  const generalCount = allThreads.length - reviewThreads.length;
  const resolvedCount = useMemo(
    () => reviewThreads.filter((t) => t.head.resolved === true).length,
    [reviewThreads],
  );

  const threads = useMemo(() => {
    const filtered = showResolved
      ? reviewThreads
      : reviewThreads.filter((t) => t.head.resolved !== true);
    return [...filtered].sort((a, b) => {
      const p = threadPriority(a) - threadPriority(b);
      if (p !== 0) return p;
      return b.head.createdAt.localeCompare(a.head.createdAt);
    });
  }, [reviewThreads, showResolved]);

  const generalFooter =
    generalCount > 0 ? (
      <button
        type="button"
        onClick={() => onOpenUrl(pr.url)}
        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70 hover:text-foreground"
        title="open general comments on GitHub"
      >
        {generalCount} general comment{generalCount === 1 ? '' : 's'}
        <ExternalLink size={9} aria-hidden />
      </button>
    ) : null;

  if (reviewThreads.length === 0) {
    return (
      <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        <span>No review comments yet</span>
        {generalFooter}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>All review comments resolved 🎉</span>
          {resolvedCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowResolved(true)}
              className="text-[10px] underline-offset-2 hover:text-foreground hover:underline"
            >
              show {resolvedCount}
            </button>
          ) : null}
        </div>
        {generalFooter}
      </div>
    );
  }

  const visible = showAll ? threads : threads.slice(0, COMMENT_DISPLAY_LIMIT);
  const hidden = threads.length - visible.length;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {visible.map((t) => (
        <li key={t.head.id}>
          <CommentThreadRow
            thread={t}
            expanded={expanded.has(t.head.id)}
            onToggle={() => toggle(t.head.id)}
            onOpenUrl={onOpenUrl}
            onSpawn={onSpawnFromComment ? () => onSpawnFromComment(t.head) : undefined}
          />
        </li>
      ))}
      {hidden > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            +{hidden} more
          </button>
        </li>
      ) : null}
      {resolvedCount > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-[10px] text-muted-foreground/70 hover:text-foreground"
          >
            {showResolved ? `hide ${resolvedCount} resolved` : `show ${resolvedCount} resolved`}
          </button>
        </li>
      ) : null}
      {generalFooter ? <li>{generalFooter}</li> : null}
    </ul>
  );
}

function CommentThreadRow({
  thread,
  expanded,
  onToggle,
  onOpenUrl,
  onSpawn,
}: {
  thread: CommentThread;
  expanded: boolean;
  onToggle: () => void;
  onOpenUrl: (url: string) => void;
  onSpawn?: () => void;
}) {
  const { head, replies } = thread;
  const isReview = head.source === 'review';
  const status: 'open' | 'resolved' | 'issue' = !isReview
    ? 'issue'
    : head.resolved
      ? 'resolved'
      : 'open';
  const statusLabel = status === 'open' ? 'open' : status === 'resolved' ? 'resolved' : 'comment';
  const bot = isBot(head.author);

  return (
    <div className="flex gap-1.5">
      <span
        aria-hidden
        title={statusLabel}
        className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center"
      >
        {status === 'resolved' ? (
          <CheckCheck size={11} className="text-success" aria-hidden />
        ) : status === 'open' ? (
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Avatar url={head.authorAvatarUrl} alt={head.author} />
          <span className="truncate font-medium text-foreground">{head.author}</span>
          {bot ? (
            <span className="rounded bg-info/10 px-1 text-[8px] uppercase tracking-wide text-info">
              bot
            </span>
          ) : null}
          <span className="opacity-50">·</span>
          <span>{formatRelative(Date.now() - new Date(head.createdAt).getTime())}</span>
          {replies.length > 0 ? (
            <span className="opacity-50">
              · +{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {onSpawn && status !== 'resolved' ? (
              <button
                type="button"
                onClick={onSpawn}
                title="create agent to resolve this comment"
                aria-label="create agent to resolve this comment"
                className="inline-flex items-center gap-0.5 rounded border border-accent/30 bg-accent/5 px-1.5 py-px text-[10px] font-medium text-accent transition-colors hover:bg-accent/15"
              >
                <Sparkles size={9} aria-hidden />
                resolve
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenUrl(head.url)}
              title="open comment in browser"
              aria-label="open comment in browser"
              className={TAB_ICON_BTN}
            >
              <ExternalLink size={9} aria-hidden />
            </button>
          </div>
        </div>
        {head.path ? (
          <button
            type="button"
            onClick={() => onOpenUrl(head.url)}
            title={`${head.path}${head.line ? ':' + head.line : ''}`}
            className="self-start truncate rounded bg-background/60 px-1 py-px font-mono text-[9px] text-muted-foreground hover:text-foreground"
          >
            {head.path}
            {head.line ? `:${head.line}` : ''}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'text-left text-[11px] text-foreground/90 hover:text-foreground',
            expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2',
          )}
          title={expanded ? 'collapse' : 'expand'}
        >
          {head.body.trim() || '(empty)'}
        </button>
        {replies.length > 0 ? (
          <ul className="ml-2 mt-1 flex flex-col gap-1 border-l border-border-soft pl-2">
            {replies.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Avatar url={r.authorAvatarUrl} alt={r.author} />
                  <span className="truncate font-medium text-foreground">{r.author}</span>
                  <span className="opacity-50">·</span>
                  <span>{formatRelative(Date.now() - new Date(r.createdAt).getTime())}</span>
                </div>
                {r.body.trim() ? (
                  <div className="text-[11px] text-foreground/90 [overflow-wrap:anywhere] [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
                    <Markdown text={r.body.trim()} className="text-[11px] leading-relaxed" />
                  </div>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground/70">(empty)</p>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function ReviewPane({
  reviews,
  requests,
  pr,
  onOpenUrl,
  onSpawnFromReviewChanges,
}: {
  reviews: ReadonlyArray<PrReview>;
  requests: ReadonlyArray<PrReviewRequest>;
  pr: PullRequestState;
  onOpenUrl: (url: string) => void;
  onSpawnFromReviewChanges?: () => void;
}) {
  const summary = summarizeReview(pr, reviews, requests);
  const perReviewer = useMemo(() => latestTerminalReviewsByAuthor(reviews), [reviews]);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
          summary.tone,
        )}
      >
        {summary.icon}
        <span>{summary.label}</span>
      </div>
      {pr.reviewDecision === 'changes_requested' && onSpawnFromReviewChanges ? (
        <button
          type="button"
          onClick={onSpawnFromReviewChanges}
          className="inline-flex w-fit items-center gap-1 rounded border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10"
          title="create agent to resolve all requested changes"
        >
          <Sparkles size={10} aria-hidden />
          resolve all requested changes
        </button>
      ) : null}
      {perReviewer.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {perReviewer.map((r) => (
            <li
              key={r.author}
              className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] text-foreground hover:bg-background"
            >
              <ReviewStateIcon state={r.state} />
              <Avatar url={r.authorAvatarUrl} alt={r.author} />
              <span className="truncate font-medium">{r.author}</span>
              {isBot(r.author) ? (
                <span className="rounded bg-info/10 px-1 text-[8px] uppercase tracking-wide text-info">
                  bot
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-[9px] text-muted-foreground/70">
                {r.submittedAt
                  ? formatRelative(Date.now() - new Date(r.submittedAt).getTime())
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {requests.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground">awaiting:</span>
          {requests.map((r) => (
            <span
              key={`${r.kind}-${r.login}`}
              className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-1.5 py-0.5 text-[10px] text-foreground"
            >
              <CircleDashed size={9} aria-hidden className="text-info" />
              <Avatar url={r.avatarUrl} alt={r.login} />
              <span className="truncate">{r.login}</span>
            </span>
          ))}
        </div>
      ) : null}
      {reviews.length === 0 && requests.length === 0 ? (
        <button
          type="button"
          onClick={() => onOpenUrl(pr.url)}
          className="inline-flex w-fit items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          view on GitHub
          <ExternalLink size={9} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ReviewStateIcon({ state }: { state: PrReviewState }) {
  const props = { size: 10, 'aria-hidden': true } as const;
  if (state === 'approved') return <CheckCheck {...props} className="text-success" />;
  if (state === 'changes_requested') return <AlertCircle {...props} className="text-danger" />;
  if (state === 'commented') return <MessageSquare {...props} className="text-muted-foreground" />;
  if (state === 'dismissed') return <MinusCircle {...props} className="text-muted-foreground" />;
  return <CircleDashed {...props} className="text-muted-foreground" />;
}

function latestTerminalReviewsByAuthor(reviews: ReadonlyArray<PrReview>): ReadonlyArray<PrReview> {
  const map = new Map<string, PrReview>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    if (r.state === 'commented' || r.state === 'pending' || r.state === 'dismissed') continue;
    map.set(r.author, r);
  }
  return [...map.values()];
}

function EmptyRow({
  text,
  actionUrl,
  actionLabel,
  onOpenUrl,
}: {
  text: string;
  actionUrl: string;
  actionLabel: string;
  onOpenUrl: (url: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>{text}</span>
      <button
        type="button"
        onClick={() => onOpenUrl(actionUrl)}
        className="inline-flex items-center gap-0.5 hover:text-foreground"
        title={actionLabel}
      >
        <ExternalLink size={9} aria-hidden />
      </button>
    </div>
  );
}

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground"
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-4 w-4 shrink-0 rounded-full" loading="lazy" />;
}

function CheckConclusionIcon({ conclusion }: { conclusion: PrCheckConclusion }) {
  const props = { size: 11, 'aria-hidden': true } as const;
  if (conclusion === 'success') return <Check {...props} className="text-success" />;
  if (conclusion === 'failure') return <XCircle {...props} className="text-danger" />;
  if (conclusion === 'pending')
    return <Clock {...props} className="text-warning motion-safe:animate-pulse" />;
  if (conclusion === 'cancelled' || conclusion === 'timed_out')
    return <CircleSlash {...props} className="text-muted-foreground" />;
  if (conclusion === 'skipped' || conclusion === 'neutral' || conclusion === 'stale')
    return <MinusCircle {...props} className="text-muted-foreground" />;
  if (conclusion === 'action_required') return <AlertCircle {...props} className="text-warning" />;
  return <HelpCircle {...props} className="text-muted-foreground" />;
}

type ReviewSummary = {
  readonly label: string;
  readonly tone: string;
  readonly icon: ReactNode;
};

function summarizeReview(
  pr: PullRequestState,
  reviews: ReadonlyArray<PrReview>,
  requests: ReadonlyArray<PrReviewRequest>,
): ReviewSummary {
  const latestByAuthor = new Map<string, PrReview>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    if (r.state === 'commented' || r.state === 'pending' || r.state === 'dismissed') continue;
    latestByAuthor.set(r.author, r);
  }
  const approvals = [...latestByAuthor.values()].filter((r) => r.state === 'approved');
  const changes = [...latestByAuthor.values()].filter((r) => r.state === 'changes_requested');
  if (changes.length > 0) {
    return {
      label: `Changes requested by ${changes.map((r) => r.author).join(', ')}`,
      tone: 'bg-danger/10 text-danger',
      icon: <AlertCircle size={10} aria-hidden />,
    };
  }
  if (pr.reviewDecision === 'approved' || approvals.length > 0) {
    const who = approvals.length > 0 ? approvals.map((r) => r.author).join(', ') : 'reviewer';
    return {
      label: `Approved by ${who}`,
      tone: 'bg-success/10 text-success',
      icon: <CheckCheck size={10} aria-hidden />,
    };
  }
  if (requests.length > 0) {
    return {
      label: 'Awaiting review',
      tone: 'bg-info/10 text-info',
      icon: <CircleDashed size={10} aria-hidden />,
    };
  }
  if (reviews.some((r) => r.state === 'commented')) {
    return {
      label: 'Reviewer commented',
      tone: 'bg-muted text-muted-foreground',
      icon: <MessageSquare size={10} aria-hidden />,
    };
  }
  return {
    label: 'No reviewer assigned',
    tone: 'bg-muted text-muted-foreground',
    icon: <CircleSlash size={10} aria-hidden />,
  };
}

export function pickSmartTab(
  pr: PullRequestState,
  detail: PrDetail | null,
  branchLastActivity: string | null,
): GithubTabKey {
  const checks = detail?.checks ?? [];
  const hasFailing = checks.some(
    (c) =>
      c.conclusion === 'failure' ||
      c.conclusion === 'cancelled' ||
      c.conclusion === 'timed_out' ||
      c.conclusion === 'action_required',
  );
  const hasPending = checks.some((c) => c.conclusion === 'pending');
  if (hasFailing || hasPending) return 'ci';
  if (pr.checks === 'failure' || pr.checks === 'pending') return 'ci';

  const reviews = detail?.reviews ?? [];
  const latestByAuthor = new Map<string, PrReviewState>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    if (r.state === 'commented' || r.state === 'pending' || r.state === 'dismissed') continue;
    latestByAuthor.set(r.author, r.state);
  }
  if ([...latestByAuthor.values()].some((s) => s === 'changes_requested')) return 'review';
  if (pr.reviewDecision === 'changes_requested') return 'review';

  const comments = detail?.comments ?? [];
  if (comments.length > 0) {
    const last = comments.reduce(
      (acc, c) => (c.createdAt > acc ? c.createdAt : acc),
      comments[0]!.createdAt,
    );
    const activity = branchLastActivity ?? pr.updatedAt;
    if (last > activity) return 'comments';
  }
  return 'ci';
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '';
  if (ms < 1_000) return `${ms}ms`;
  const s = Math.round(ms / 1_000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
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

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PrComment, PullRequestState } from '@goodboy/types';
import { Button, Divider, EmptyState, Markdown, cn } from '@goodboy/ui';
import { CheckCheck, ExternalLink, MessageSquare } from 'lucide-react';
import { type CommentThread, groupThreads, isBot, threadPriority } from '../../comment-threads';

type Props = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly pr: PullRequestState;
  readonly scrollToThreadId?: string | null;
  readonly onOpenUrl: (url: string) => void;
};

export function PrConversation({ comments, pr, scrollToThreadId = null, onOpenUrl }: Props) {
  const threads = useMemo(() => {
    const all = groupThreads(comments);
    return [...all].sort((a, b) => {
      const p = threadPriority(a) - threadPriority(b);
      if (p !== 0) return p;
      return b.head.createdAt.localeCompare(a.head.createdAt);
    });
  }, [comments]);

  const threadRefs = useRef(new Map<string, HTMLLIElement>());
  const [flashThreadId, setFlashThreadId] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollToThreadId) return;
    const el = threadRefs.current.get(scrollToThreadId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashThreadId(scrollToThreadId);
    const t = setTimeout(() => setFlashThreadId(null), 1600);
    return () => clearTimeout(t);
  }, [scrollToThreadId, threads]);

  if (threads.length === 0) {
    return (
      <EmptyState
        bordered
        icon={MessageSquare}
        title="No comments yet"
        description="Review comments and replies on this pull request will show up here."
        action={
          <Button variant="ghost" size="sm" onClick={() => onOpenUrl(pr.url)}>
            View conversation on GitHub
            <ExternalLink size={12} aria-hidden />
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {threads.map((t) => {
          const tid = t.head.threadId ?? null;
          return (
            <li
              key={t.head.id}
              ref={(el) => {
                if (!tid) return;
                if (el) threadRefs.current.set(tid, el);
                else threadRefs.current.delete(tid);
              }}
              className={cn(
                'rounded-lg transition-shadow',
                tid && tid === flashThreadId ? 'ring-2 ring-accent/60' : '',
              )}
            >
              <ConversationThread thread={t} onOpenUrl={onOpenUrl} />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onOpenUrl(pr.url)}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        open full conversation on GitHub
        <ExternalLink size={11} aria-hidden />
      </button>
    </div>
  );
}

function ConversationThread({
  thread,
  onOpenUrl,
}: {
  thread: CommentThread;
  onOpenUrl: (url: string) => void;
}) {
  const { head, replies } = thread;
  const isReview = head.source === 'review';
  const resolved = isReview && head.resolved === true;
  const open = isReview && head.resolved === false;

  return (
    <div
      className={
        resolved
          ? 'rounded-lg border border-border-soft bg-muted/5 p-3'
          : 'rounded-lg border border-border-soft bg-muted/10 p-3'
      }
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Avatar url={head.authorAvatarUrl} alt={head.author} />
        <span className="font-medium text-foreground">{head.author}</span>
        {isBot(head.author) ? (
          <span className="rounded bg-info/10 px-1 text-[9px] uppercase tracking-wide text-info">
            bot
          </span>
        ) : null}
        <span className="opacity-50">·</span>
        <span>{formatRelative(Date.now() - new Date(head.createdAt).getTime())}</span>
        {open ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
            open
          </span>
        ) : null}
        {resolved ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
            <CheckCheck size={11} aria-hidden />
            resolved
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onOpenUrl(head.url)}
          title="open in browser"
          aria-label="open in browser"
          className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink size={12} aria-hidden />
        </button>
      </div>

      {head.path ? (
        <button
          type="button"
          onClick={() => onOpenUrl(head.url)}
          title={`${head.path}${head.line ? ':' + head.line : ''}`}
          className="mt-1.5 block max-w-full truncate rounded bg-background/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          {head.path}
          {head.line ? `:${head.line}` : ''}
        </button>
      ) : null}

      <div className="mt-1.5 [overflow-wrap:anywhere]">
        {head.body.trim() ? (
          <Markdown text={head.body.trim()} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/70">(empty)</p>
        )}
      </div>

      {replies.length > 0 ? (
        <div className="ml-3 mt-2 flex gap-2">
          <Divider orientation="vertical" />
          <ul className="flex flex-1 flex-col gap-2">
            {replies.map((r) => (
              <li key={r.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar url={r.authorAvatarUrl} alt={r.author} />
                  <span className="font-medium text-foreground">{r.author}</span>
                  <span className="opacity-50">·</span>
                  <span>{formatRelative(Date.now() - new Date(r.createdAt).getTime())}</span>
                </div>
                <div className="[overflow-wrap:anywhere]">
                  {r.body.trim() ? (
                    <Markdown text={r.body.trim()} className="text-sm leading-relaxed" />
                  ) : (
                    <p className="text-sm italic text-muted-foreground/70">(empty)</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground"
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-5 w-5 shrink-0 rounded-full" loading="lazy" />;
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

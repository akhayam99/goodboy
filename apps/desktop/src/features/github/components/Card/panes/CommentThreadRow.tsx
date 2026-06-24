import { CheckCheck, ExternalLink, Sparkles } from 'lucide-react';
import { cn, Markdown, StatusDot } from '@goodboy/ui';
import { type CommentThread, isBot } from '../../../comment-threads';
import { formatRelative, TAB_ICON_BTN } from '../lib';
import { Avatar } from '../parts/Avatar';

type Props = {
  readonly thread: CommentThread;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onOpenUrl: (url: string) => void;
  readonly onSpawn?: () => void;
};

export const CommentThreadRow = ({ thread, expanded, onToggle, onOpenUrl, onSpawn }: Props) => {
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
          <StatusDot tone="warning" size="sm" />
        ) : (
          <StatusDot tone="neutral" size="sm" />
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
          {replies.length > 0 && (
            <span className="opacity-50">
              · +{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
            </span>
          )}
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
        {replies.length > 0 && (
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
        )}
      </div>
    </div>
  );
};

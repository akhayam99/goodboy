import { CheckCheck, ExternalLink, Sparkles } from 'lucide-react';
import { cn, Markdown, StatusDot } from '@goodboy/ui';
import { type CommentThread, isBot } from '../../../comment-threads';
import { TAB_ICON_BTN } from '../lib';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
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
  const statusLabel = status === 'open' ? 'Open' : status === 'resolved' ? 'Resolved' : 'Comment';
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
        <div className="flex items-center gap-1 text-3xs text-muted-foreground">
          <Avatar url={head.authorAvatarUrl} alt={head.author} />
          <span className="truncate font-medium text-foreground">{head.author}</span>
          {bot ? (
            <span className="rounded bg-info/10 px-1 text-3xs uppercase tracking-wide text-info">
              bot
            </span>
          ) : null}
          <span className="opacity-50">·</span>
          <span>{formatRelativeAge({ fromIso: head.createdAt })}</span>
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
                title="Create agent to resolve this comment"
                aria-label="Create agent to resolve this comment"
                className="inline-flex items-center gap-0.5 rounded border border-accent/30 bg-accent/5 px-1.5 py-px text-3xs font-medium text-accent transition-colors hover:bg-accent/15"
              >
                <Sparkles size={9} aria-hidden />
                resolve
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenUrl(head.url)}
              title="Open comment in browser"
              aria-label="Open comment in browser"
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
            className="self-start truncate rounded bg-background/60 px-1 py-px font-mono text-3xs text-muted-foreground hover:text-foreground"
          >
            {head.path}
            {head.line ? `:${head.line}` : ''}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'text-left text-2xs text-foreground/90 hover:text-foreground',
            expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2',
          )}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {head.body.trim() || '(empty)'}
        </button>
        {replies.length > 0 && (
          <ul className="ml-2 mt-1 flex flex-col gap-1 border-l border-border-soft pl-2">
            {replies.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1 text-3xs text-muted-foreground">
                  <Avatar url={r.authorAvatarUrl} alt={r.author} />
                  <span className="truncate font-medium text-foreground">{r.author}</span>
                  <span className="opacity-50">·</span>
                  <span>{formatRelativeAge({ fromIso: r.createdAt })}</span>
                </div>
                {r.body.trim() ? (
                  <div className="text-2xs text-foreground/90 [overflow-wrap:anywhere] [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
                    <Markdown text={r.body.trim()} className="text-2xs leading-relaxed" />
                  </div>
                ) : (
                  <p className="text-2xs italic text-muted-foreground/70">(empty)</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

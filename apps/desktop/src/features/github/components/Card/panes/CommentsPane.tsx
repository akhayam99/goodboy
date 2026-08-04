import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { PrComment, PullRequestState } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { groupThreads, threadPriority } from '../../../comment-threads';
import { COMMENT_DISPLAY_LIMIT } from '../lib';
import { CommentThreadRow } from './CommentThreadRow';

type Props = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly pr: PullRequestState;
  readonly onOpenUrl: (url: string) => void;
  readonly onSpawnFromComment?: (c: PrComment) => void;
};

export const CommentsPane = ({ comments, pr, onOpenUrl, onSpawnFromComment }: Props) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const allThreads = useMemo(() => groupThreads(comments), [comments]);

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
      if (p !== 0) {
        return p;
      }
      return b.head.createdAt.localeCompare(a.head.createdAt);
    });
  }, [reviewThreads, showResolved]);

  const generalFooter =
    generalCount > 0 ? (
      <button
        type="button"
        onClick={() => onOpenUrl(pr.url)}
        className="inline-flex items-center gap-0.5 text-3xs text-muted-foreground/70 hover:text-foreground"
        title="Open general comments on GitHub"
      >
        {generalCount} general comment{generalCount === 1 ? '' : 's'}
        <ExternalLink size={9} aria-hidden />
      </button>
    ) : null;

  if (reviewThreads.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.comments}
        tone={CONCEPT_TONE.comments}
        title="No review comments yet"
        size="inline"
        action={generalFooter}
      />
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.resolve}
        tone={CONCEPT_TONE.resolve}
        title="All review comments resolved"
        size="inline"
        action={
          <div className="flex flex-col items-start gap-1">
            {resolvedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowResolved(true)}
                className="text-3xs underline-offset-2 hover:text-foreground hover:underline"
              >
                show {resolvedCount}
              </button>
            ) : null}
            {generalFooter}
          </div>
        }
      />
    );
  }

  const visible = showAll ? threads : threads.slice(0, COMMENT_DISPLAY_LIMIT);
  const hidden = threads.length - visible.length;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-3xs text-muted-foreground hover:text-foreground"
          >
            +{hidden} more
          </button>
        </li>
      )}
      {resolvedCount > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-3xs text-muted-foreground/70 hover:text-foreground"
          >
            {showResolved ? `hide ${resolvedCount} resolved` : `show ${resolvedCount} resolved`}
          </button>
        </li>
      )}
      {generalFooter ? <li>{generalFooter}</li> : null}
    </ul>
  );
};

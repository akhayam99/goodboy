import { useState } from 'react';
import type { PrComment } from '@goodboy/types';
import { Divider, cn } from '@goodboy/ui';
import { ChevronRight } from 'lucide-react';
import { isBot } from '../../comment-threads';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { ThreadAvatar } from './ThreadAvatar';
import { ThreadBody } from './ThreadBody';

type Props = {
  readonly replies: ReadonlyArray<PrComment>;
};

const INLINE_REPLY_LIMIT = 2;

export const ThreadReplies = ({ replies }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (replies.length === 0) {
    return null;
  }

  const collapsible = replies.length > INLINE_REPLY_LIMIT;
  const hidden = collapsible && !expanded;

  return (
    <div className="ml-3 flex gap-2">
      <Divider orientation="vertical" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {collapsible && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex w-fit items-center gap-1 rounded text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight
              size={11}
              aria-hidden
              className={cn('motion-safe:transition-transform', expanded && 'rotate-90')}
            />
            {replies.length} replies
          </button>
        )}
        {!hidden && (
          <ul className="flex flex-col gap-2">
            {replies.map((r) => (
              <li key={r.id} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ThreadAvatar url={r.authorAvatarUrl} alt={r.author} />
                  <span className="font-medium text-foreground">{r.author}</span>
                  <span className="opacity-50">·</span>
                  <span>{formatRelativeAge({ fromIso: r.createdAt })}</span>
                </div>
                <div className="[overflow-wrap:anywhere]">
                  <ThreadBody body={r.body} clamped={isBot(r.author)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

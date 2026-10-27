import { useState } from 'react';
import { Avatar, Disclosure } from '@goodboy/ui';
import { useNow } from '../../hooks/useNow';
import { formatAge } from '../../utils/time/formatAge';
import { ThreadBody } from '../ThreadBody';
import type { ThreadReplyItem } from './threadReplyItem';

type Props = {
  readonly replies: ReadonlyArray<ThreadReplyItem>;
};

const INLINE_REPLY_LIMIT = 2;

export const FullReplies = ({ replies }: Props) => {
  const now = useNow(30_000);
  const [isOpen, setIsOpen] = useState(false);

  const list = (
    <ul aria-label="Replies" className="flex flex-col gap-2">
      {replies.map((reply) => (
        <li key={reply.id} className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2 text-meta text-muted-foreground">
            <Avatar url={reply.avatarUrl ?? null} alt={reply.author} />
            <span className="text-row text-foreground">{reply.author}</span>
            {reply.createdAt === undefined ? null : (
              <>
                <span className="opacity-50">·</span>
                <span>{formatAge({ from: reply.createdAt, now })}</span>
              </>
            )}
          </div>
          <div className="[overflow-wrap:anywhere]">
            <ThreadBody body={reply.body} isClamped={reply.isBot === true} />
          </div>
        </li>
      ))}
    </ul>
  );

  if (replies.length <= INLINE_REPLY_LIMIT) {
    return <div className="flex min-w-0 flex-1 flex-col">{list}</div>;
  }

  return (
    <Disclosure
      label={`${replies.length} replies`}
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      className="flex-1"
      triggerClassName="w-fit text-chip text-muted-foreground"
    >
      {list}
    </Disclosure>
  );
};

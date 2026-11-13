import { Person } from '../Person';
import { FullReplies } from './FullReplies';
import type { ThreadReplyItem } from './threadReplyItem';

type ThreadRepliesMode = 'collapsed' | 'full';

type Props = {
  readonly replies: ReadonlyArray<ThreadReplyItem>;
  readonly mode?: ThreadRepliesMode;
};

type LineParams = {
  readonly body: string;
};

const replyHeadOf = ({ body }: LineParams): string => body.split('\n')[0] ?? '';

export const ThreadReplies = ({ replies, mode = 'full' }: Props) => {
  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 border-l border-border-soft pl-3">
      {mode === 'full' ? (
        <FullReplies replies={replies} />
      ) : (
        <ul aria-label="Replies" className="flex min-w-0 flex-1 flex-col gap-1">
          {replies.map((reply) => (
            <li key={reply.id} className="flex min-w-0 gap-2 text-meta">
              <span className="shrink-0">
                <Person
                  login={reply.author}
                  avatarUrl={reply.avatarUrl ?? null}
                  size="xs"
                  isBot={reply.isBot === true}
                />
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {replyHeadOf({ body: reply.body })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

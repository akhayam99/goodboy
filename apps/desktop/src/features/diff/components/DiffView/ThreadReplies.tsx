import type { DiffThreadReply } from './types';

type Props = {
  readonly replies: ReadonlyArray<DiffThreadReply>;
};

const firstLine = (body: string): string => body.split('\n')[0] ?? '';

export const ThreadReplies = ({ replies }: Props) => (
  <ul aria-label="Replies" className="flex min-w-0 flex-col gap-1 border-l border-border-soft pl-3">
    {replies.map((reply) => (
      <li key={reply.id} className="flex min-w-0 gap-2 text-meta">
        <span className="shrink-0 text-row text-foreground">{reply.author}</span>
        <span className="min-w-0 truncate text-muted-foreground">{firstLine(reply.body)}</span>
      </li>
    ))}
  </ul>
);

type CountParams = {
  readonly count: number;
};

export const repliesLabel = ({ count }: CountParams): string =>
  count === 1 ? '1 reply' : `${count} replies`;

import { Button, Chip } from '@goodboy/ui';
import { COMMENT_RUN_COPY } from '../../../resolve/commentRunCopy';
import type { CommentRunHead } from '../../../resolve/commentRunHeadsOf';

type Props = {
  readonly source: CommentRunHead;
  readonly hostLabel: string;
  readonly onOpen: () => void;
};

const placeOf = ({ head }: Pick<CommentRunHead, 'head'>): string | null => {
  if (head?.path === undefined || head.path === '') {
    return null;
  }
  return head.line === undefined ? head.path : `${head.path}:${head.line}`;
};

export const CommentRunSourceCard = ({ source, hostLabel, onOpen }: Props) => {
  const { head, isNote } = source;
  const place = placeOf({ head });
  const status =
    head?.resolved === true
      ? COMMENT_RUN_COPY.resolvedOn({ label: isNote ? null : hostLabel })
      : COMMENT_RUN_COPY.stillOpen;
  return (
    <li className="flex min-w-0 list-none flex-col gap-1 rounded-md bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
        {head === null ? null : <span className="shrink-0 text-foreground">{head.author}</span>}
        <Chip
          tone="neutral"
          kind="state"
          bordered={false}
          label={isNote ? COMMENT_RUN_COPY.note : hostLabel}
        />
        {place === null ? null : (
          <span className="min-w-0 truncate text-code text-faint-foreground">{place}</span>
        )}
      </div>
      <p className="line-clamp-3 min-w-0 whitespace-pre-wrap text-comment text-foreground">
        {head === null ? COMMENT_RUN_COPY.unavailable : head.body}
      </p>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-meta text-faint-foreground">{status}</span>
        <Button size="sm" variant="ghost" onClick={onOpen}>
          {COMMENT_RUN_COPY.openComment}
        </Button>
      </div>
    </li>
  );
};

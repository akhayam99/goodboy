import { SelectableRow } from '@goodboy/ui';
import type { PrComment } from '@goodboy/types';
import { firstLineOf } from '../../../../shared/utils/firstLineOf';
import { DESK_PR_COPY } from './deskPrCopy';

type Props = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly onOpen: (comment: PrComment) => void;
};

const SHOWN_CAP = 6;

export const DeskPrConversation = ({ comments, onOpen }: Props) => {
  const roots = comments.filter((comment) => comment.inReplyToId === undefined);
  const shown = [
    ...roots.filter((comment) => comment.resolved !== true),
    ...roots.filter((comment) => comment.resolved === true),
  ].slice(0, SHOWN_CAP);
  if (shown.length === 0) {
    return <p className="text-body text-muted-foreground">{DESK_PR_COPY.noComments}</p>;
  }
  return (
    <ul aria-label={DESK_PR_COPY.commentsLabel} className="flex min-w-0 flex-col gap-1">
      {shown.map((comment) => (
        <li key={comment.id} className="min-w-0">
          <SelectableRow selected={false} onClick={() => onOpen(comment)}>
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-row text-foreground">{comment.author}</span>
                {comment.path === undefined ? null : (
                  <span className="truncate text-meta text-muted-foreground">
                    {comment.line === undefined ? comment.path : `${comment.path}:${comment.line}`}
                  </span>
                )}
              </span>
              <span className="truncate text-meta text-muted-foreground">
                {firstLineOf({ text: comment.body }) ?? ''}
              </span>
            </span>
          </SelectableRow>
        </li>
      ))}
    </ul>
  );
};

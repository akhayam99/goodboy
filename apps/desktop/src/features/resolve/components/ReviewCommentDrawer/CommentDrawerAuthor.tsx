import { Chip } from '@goodboy/ui';
import { Person } from '../../../../shared/components/Person';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { isBot } from '../../../integrations/github/comment-threads';
import { REVIEW_COMMENT_TONE } from '../../reviewCommentState';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';

type Props = {
  readonly entry: ReviewEntry;
};

export const CommentDrawerAuthor = ({ entry }: Props) => {
  const now = useNow(60_000);
  const note = entry.row.reviewerNote;
  const head = entry.row.commentThread?.head ?? null;
  if (note === null) {
    return null;
  }
  const reference =
    note.path === null ? null : note.line == null ? note.path : `${note.path}:${note.line}`;
  const isOutdated = head?.outdated === true;
  return (
    <div data-drawer-author="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Person
          login={note.author}
          avatarUrl={head?.authorAvatarUrl ?? null}
          size="md"
          isBot={isBot(note.author)}
        />
        <span className="shrink-0 text-meta text-faint-foreground">
          {formatAge({ from: note.createdAtMs, now })}
        </span>
        <Chip
          tone={REVIEW_COMMENT_TONE[entry.toneKey]}
          kind="state"
          bordered={false}
          label={entry.word}
        />
        {isOutdated ? (
          <Chip tone="warning" kind="state" bordered={false} label={REVIEW_FLOW_LABEL.lineMoved} />
        ) : null}
      </div>
      {reference === null ? null : (
        <p
          data-drawer-file=""
          className="min-w-0 truncate font-mono text-code text-muted-foreground"
        >
          {reference}
        </p>
      )}
    </div>
  );
};

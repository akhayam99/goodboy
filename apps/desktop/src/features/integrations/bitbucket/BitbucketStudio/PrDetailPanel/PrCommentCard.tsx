import { Markdown } from '@goodboy/ui';
import { IssueNoteAvatar } from '../../../components/IssueNoteAvatar';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import type { BitbucketComment } from '../../client';

type Props = {
  readonly comment: BitbucketComment;
};

export const PrCommentCard = ({ comment }: Props) => {
  const name = comment.user?.displayName ?? 'Unknown';
  const age = formatRelativeAge({ fromIso: comment.createdOn });
  const inline = comment.inline;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <IssueNoteAvatar url={comment.user?.avatarUrl ?? null} alt={name} />
        <span className="font-medium text-foreground">{name}</span>
        {age !== '' && (
          <>
            <span className="opacity-50">·</span>
            <span>{age}</span>
          </>
        )}
      </div>
      {inline != null && (
        <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground/70">
          {inline.path}
          {inline.to != null ? `:${inline.to}` : ''}
        </span>
      )}
      <Markdown text={comment.body} className="text-sm leading-relaxed" />
    </div>
  );
};

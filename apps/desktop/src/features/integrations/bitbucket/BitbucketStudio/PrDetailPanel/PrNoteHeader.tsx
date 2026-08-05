import { IssueNoteAvatar } from '../../../components/IssueNoteAvatar';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import type { BitbucketComment } from '../../client';

type Props = {
  readonly comment: BitbucketComment;
};

export const PrNoteHeader = ({ comment }: Props) => {
  const name = comment.user?.displayName ?? 'Unknown';
  const age = formatRelativeAge({ fromIso: comment.createdOn });

  return (
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
  );
};

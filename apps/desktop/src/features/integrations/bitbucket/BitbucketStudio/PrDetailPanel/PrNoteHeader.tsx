import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { Avatar } from '@goodboy/ui';
import { NoteHeader } from '@goodboy/ui';
import type { BitbucketComment } from '../../client';

type Props = {
  readonly comment: BitbucketComment;
};

export const PrNoteHeader = ({ comment }: Props) => {
  const name = comment.user?.displayName ?? 'Unknown';
  const age = formatRelativeAge({ fromIso: comment.createdOn });

  return (
    <NoteHeader
      avatar={<Avatar url={comment.user?.avatarUrl ?? null} alt={name} />}
      author={name}
      timestamp={
        age !== '' && (
          <>
            <span className="opacity-50">·</span>
            <span>{age}</span>
          </>
        )
      }
    />
  );
};

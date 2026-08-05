import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { NoteAvatar } from '../../../../../shared/components/NoteAvatar';
import { NoteHeader } from '../../../../../shared/components/NoteHeader';
import type { BitbucketComment } from '../../client';

type Props = {
  readonly comment: BitbucketComment;
};

export const PrNoteHeader = ({ comment }: Props) => {
  const name = comment.user?.displayName ?? 'Unknown';
  const age = formatRelativeAge({ fromIso: comment.createdOn });

  return (
    <NoteHeader
      avatar={<NoteAvatar url={comment.user?.avatarUrl ?? null} alt={name} />}
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

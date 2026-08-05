import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { NoteAvatar } from '../../../../../shared/components/NoteAvatar';
import { NoteHeader } from '../../../../../shared/components/NoteHeader';
import type { GitlabMrNote } from '../../client';

type Props = {
  readonly note: GitlabMrNote;
};

export const MrNoteHeader = ({ note }: Props) => {
  const age = formatRelativeAge({ fromIso: note.createdAt });
  const name = note.author?.name ?? 'Unknown';

  return (
    <NoteHeader
      avatar={<NoteAvatar url={note.author?.avatarUrl ?? null} alt={name} />}
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

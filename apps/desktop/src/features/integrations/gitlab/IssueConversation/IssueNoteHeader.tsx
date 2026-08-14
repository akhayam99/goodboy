import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { Avatar } from '@goodboy/ui';
import { NoteHeader } from '@goodboy/ui';
import type { GitlabIssueNote } from '../client';

type Props = {
  readonly note: GitlabIssueNote;
};

export const IssueNoteHeader = ({ note }: Props) => {
  const age = formatRelativeAge({ fromIso: note.createdAt });
  const name = note.author?.name ?? 'Unknown';

  return (
    <NoteHeader
      avatar={<Avatar url={note.author?.avatarUrl ?? null} alt={name} />}
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

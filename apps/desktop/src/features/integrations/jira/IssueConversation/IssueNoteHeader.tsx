import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { Avatar } from '@goodboy/ui';
import { NoteHeader } from '@goodboy/ui';
import type { JiraComment } from '../client';

type Props = {
  readonly comment: JiraComment;
};

export const IssueNoteHeader = ({ comment }: Props) => {
  const age = formatRelativeAge({ fromIso: comment.created });
  const name = comment.author?.displayName ?? 'Unknown';

  return (
    <NoteHeader
      avatar={<Avatar url={comment.author?.avatarUrls?.['24x24'] ?? null} alt={name} />}
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

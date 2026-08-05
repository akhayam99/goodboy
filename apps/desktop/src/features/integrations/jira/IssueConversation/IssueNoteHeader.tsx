import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { IssueNoteAvatar } from '../../components/IssueNoteAvatar';
import type { JiraComment } from '../client';

type Props = {
  readonly comment: JiraComment;
};

export const IssueNoteHeader = ({ comment }: Props) => {
  const age = formatRelativeAge({ fromIso: comment.created });
  const name = comment.author?.displayName ?? 'Unknown';

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <IssueNoteAvatar url={comment.author?.avatarUrls?.['24x24'] ?? null} alt={name} />
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

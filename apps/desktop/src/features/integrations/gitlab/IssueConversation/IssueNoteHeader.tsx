import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import type { GitlabIssueNote } from '../client';
import { IssueNoteAvatar } from './IssueNoteAvatar';

type Props = {
  readonly note: GitlabIssueNote;
};

export const IssueNoteHeader = ({ note }: Props) => {
  const age = formatRelativeAge({ fromIso: note.createdAt });
  const name = note.author?.name ?? 'Unknown';

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <IssueNoteAvatar url={note.author?.avatarUrl ?? null} alt={name} />
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

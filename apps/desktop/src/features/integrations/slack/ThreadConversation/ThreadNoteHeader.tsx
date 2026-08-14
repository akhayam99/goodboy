import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { Avatar } from '@goodboy/ui';
import { NoteHeader } from '@goodboy/ui';
import type { SlackMessage, SlackUser } from '../client';

type Props = {
  readonly message: SlackMessage;
  readonly author: SlackUser | null;
};

export const ThreadNoteHeader = ({ message, author }: Props) => {
  const name = author?.name ?? message.userId ?? 'Unknown';
  const age = message.postedAt != null ? formatRelativeAge({ fromIso: message.postedAt }) : '';

  return (
    <NoteHeader
      avatar={<Avatar url={author?.avatarUrl ?? null} alt={name} />}
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

import { useState } from 'react';
import type { ConversationAuthor } from './types';

type Props = {
  readonly author: ConversationAuthor;
};

const initialsOf = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  const letters =
    words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : name.slice(0, 2);
  const initials = letters.toUpperCase();
  return initials !== '' ? initials : '?';
};

export const ConversationAvatar = ({ author }: Props) => {
  const [hasFailed, setHasFailed] = useState(false);

  if (author.avatarUrl == null || author.avatarUrl === '' || hasFailed) {
    return (
      <span
        aria-hidden
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-meta font-semibold text-muted-foreground"
      >
        {initialsOf(author.name)}
      </span>
    );
  }

  return (
    <img
      src={author.avatarUrl}
      alt={author.name}
      loading="lazy"
      onError={() => setHasFailed(true)}
      className="h-6 w-6 shrink-0 rounded-full"
    />
  );
};

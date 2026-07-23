import { useState } from 'react';

type Props = {
  readonly author: string;
  readonly avatarUrl: string | null;
};

export const AuthorAvatar = ({ author, avatarUrl }: Props) => {
  const [failed, setFailed] = useState(false);
  const initial = author.slice(0, 1).toUpperCase();

  if (avatarUrl == null || failed) {
    return (
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground"
      >
        {initial !== '' ? initial : '?'}
      </span>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      className="size-4 shrink-0 rounded-full object-cover"
    />
  );
};

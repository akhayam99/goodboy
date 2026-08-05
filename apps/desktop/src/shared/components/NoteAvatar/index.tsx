import { useState } from 'react';

type NoteAvatarSize = 'xs' | 'sm';

type Props = {
  readonly url: string | null;
  readonly alt: string;
  readonly size?: NoteAvatarSize;
  readonly initialsSource?: string;
};

const DIMENSION_CLASS: Record<NoteAvatarSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
};

const FALLBACK_TEXT_CLASS: Record<NoteAvatarSize, string> = {
  xs: 'text-3xs',
  sm: 'text-2xs',
};

export const NoteAvatar = ({ url, alt, size = 'sm', initialsSource = alt }: Props) => {
  const [failed, setFailed] = useState(false);
  const dimension = DIMENSION_CLASS[size];

  if (url == null || url === '' || failed) {
    const initial = initialsSource.slice(0, 1).toUpperCase();
    return (
      <span
        aria-hidden
        className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full bg-muted ${FALLBACK_TEXT_CLASS[size]} font-semibold text-muted-foreground`}
      >
        {initial !== '' ? initial : '?'}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${dimension} shrink-0 rounded-full`}
    />
  );
};

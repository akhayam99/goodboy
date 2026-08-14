import { useState } from 'react';
import { cn } from '../cn';

type AvatarSize = 'xs' | 'sm';

type Props = {
  readonly url: string | null;
  readonly alt: string;
  readonly size?: AvatarSize;
  readonly initialsSource?: string;
};

const DIMENSION_CLASS: Record<AvatarSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
};

const FALLBACK_TEXT_CLASS: Record<AvatarSize, string> = {
  xs: 'text-3xs',
  sm: 'text-2xs',
};

export const Avatar = ({ url, alt, size = 'sm', initialsSource = alt }: Props) => {
  const [failed, setFailed] = useState(false);
  const dimension = DIMENSION_CLASS[size];

  if (url == null || url === '' || failed) {
    const initial = initialsSource.slice(0, 1).toUpperCase();
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground',
          dimension,
          FALLBACK_TEXT_CLASS[size],
        )}
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
      className={cn('shrink-0 rounded-full', dimension)}
    />
  );
};

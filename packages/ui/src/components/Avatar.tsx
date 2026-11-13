import { useContext, useEffect, useState } from 'react';
import { cn } from '../cn';
import { personHueOf } from '../personHueOf';
import { RemoteImageAvatarLoaderContext } from './RemoteImage/loaderContext';

type AvatarSize = 'xs' | 'sm';

type Props = {
  readonly url: string | null;
  readonly alt: string;
  readonly size?: AvatarSize;
  readonly initialsSource?: string;
};

type Result = {
  readonly url: string;
  readonly dataUri: string | null;
};

const DIMENSION_CLASS: Record<AvatarSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
};

const FALLBACK_TEXT_CLASS: Record<AvatarSize, string> = {
  xs: 'text-chip',
  sm: 'text-meta',
};

export const Avatar = ({ url, alt, size = 'sm', initialsSource = alt }: Props) => {
  const load = useContext(RemoteImageAvatarLoaderContext);
  const [result, setResult] = useState<Result | null>(null);
  const address = url ?? '';
  const dimension = DIMENSION_CLASS[size];

  useEffect(() => {
    if (address === '' || load == null) {
      return;
    }
    let isCurrent = true;
    load({ url: address })
      .then((dataUri) => {
        if (isCurrent) {
          setResult({ url: address, dataUri: dataUri.startsWith('data:') ? dataUri : null });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setResult({ url: address, dataUri: null });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [address, load]);

  const dataUri = result != null && result.url === address ? result.dataUri : null;

  if (dataUri == null) {
    const initial = initialsSource.slice(0, 1).toUpperCase();
    const hue = personHueOf({ login: initialsSource });
    return (
      <span
        aria-hidden
        style={{
          backgroundColor: `oklch(0.92 0.04 ${hue})`,
          color: `oklch(0.38 0.09 ${hue})`,
        }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
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
      src={dataUri}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      onError={() => setResult({ url: address, dataUri: null })}
      className={cn('shrink-0 rounded-full', dimension)}
    />
  );
};

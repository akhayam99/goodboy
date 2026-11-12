import { useState } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { hostOf } from '../../hostOf';
import { originOf } from '../../originOf';

type Props = {
  readonly url: string;
  readonly isPin?: boolean;
};

const PIN_TINT = tintClasses('info');

export const BrowserFavicon = ({ url, isPin = false }: Props) => {
  const origin = originOf({ url });
  const src = useAppStore((state) =>
    origin === null ? null : (state.browserFavicons[origin] ?? null),
  );
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const letter = hostOf({ url }).charAt(0).toUpperCase();
  if (src !== null && src !== brokenSrc) {
    return (
      <img
        alt=""
        aria-hidden
        src={src}
        draggable={false}
        onError={() => setBrokenSrc(src)}
        className="size-4 shrink-0 rounded-sm object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm text-rail',
        isPin ? cn(PIN_TINT.bg, PIN_TINT.text) : 'bg-muted text-muted-foreground',
      )}
    >
      {letter === '' ? '?' : letter}
    </span>
  );
};

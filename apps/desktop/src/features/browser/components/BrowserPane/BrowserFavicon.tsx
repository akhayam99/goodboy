import { cn, tintClasses } from '@goodboy/ui';
import { hostOf } from '../../hostOf';

type Props = {
  readonly url: string;
  readonly isPin?: boolean;
  readonly isAsleep?: boolean;
};

const PIN_TINT = tintClasses('info');

export const BrowserFavicon = ({ url, isPin = false, isAsleep = false }: Props) => {
  const letter = hostOf({ url }).charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm text-rail',
        isPin ? cn(PIN_TINT.bg, PIN_TINT.text) : 'bg-muted text-muted-foreground',
        isAsleep && 'opacity-50',
      )}
    >
      {letter === '' ? '?' : letter}
    </span>
  );
};

import { useContext } from 'react';
import { Play } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';
import { Button } from './Button';
import { hostOf } from './RemoteImage/hostOf';
import { RemoteMediaOpenContext } from './RemoteImage/loaderContext';

type Props = {
  readonly url: string;
  readonly className?: string;
};

export const VideoPoster = ({ url, className }: Props) => {
  const open = useContext(RemoteMediaOpenContext);
  return (
    <span
      data-block="video-poster"
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3 py-3 text-left',
        className,
      )}
    >
      <Play size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-row text-foreground">Video</span>
        <span className="truncate text-meta text-muted-foreground">{hostOf({ url })}</span>
      </span>
      {open != null && (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={() => open(url)}>
          Open on the host
        </Button>
      )}
    </span>
  );
};

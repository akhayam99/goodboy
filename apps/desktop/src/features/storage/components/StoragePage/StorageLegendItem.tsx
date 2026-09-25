import { cn } from '@goodboy/ui';
import { formatBytes } from '../../../../shared/utils/formatBytes';

export type StorageSegment = {
  readonly key: string;
  readonly label: string;
  readonly bytes: number;
  readonly detail: string;
  readonly swatch: string;
  readonly target: string;
};

type Props = {
  readonly segment: StorageSegment;
};

export const StorageLegendItem = ({ segment }: Props) => (
  <button
    type="button"
    onClick={() =>
      document
        .getElementById(segment.target)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    className="flex h-6 items-center gap-2 rounded-sm px-1 text-left text-xs text-foreground hover:bg-hover"
  >
    <i aria-hidden className={cn('block size-2.5 shrink-0 rounded-sm', segment.swatch)} />
    <span className="min-w-0 truncate">{segment.label}</span>
    <span className="ml-auto tabular-nums text-muted-foreground">
      {formatBytes({ bytes: segment.bytes })}
    </span>
    <span className="w-20 shrink-0 truncate text-right text-2xs tabular-nums text-faint-foreground">
      {segment.detail}
    </span>
  </button>
);

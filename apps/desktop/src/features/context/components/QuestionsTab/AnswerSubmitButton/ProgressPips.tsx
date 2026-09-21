import { cn } from '@goodboy/ui';

type Props = {
  readonly index: number;
  readonly total: number;
};

const pipClass = ({ position, index }: { readonly position: number; readonly index: number }) => {
  if (position === index) {
    return 'w-3 bg-primary';
  }
  if (position < index) {
    return 'w-1.5 bg-primary/40';
  }
  return 'w-1.5 bg-border';
};

export const ProgressPips = ({ index, total }: Props) => (
  <span
    role="img"
    aria-label={`Question ${index + 1} of ${total}`}
    className="flex shrink-0 items-center gap-1"
  >
    {Array.from({ length: total }, (_, position) => (
      <span
        key={position}
        className={cn('h-1.5 rounded-full transition-all', pipClass({ position, index }))}
      />
    ))}
  </span>
);

import { cn } from '@goodboy/ui';

type Props = {
  readonly number: number;
  readonly isClosed?: boolean;
};

export const DecisionNumber = ({ number, isClosed = false }: Props) => (
  <span
    aria-hidden
    className={cn(
      'flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-meta',
      isClosed ? 'text-faint-foreground' : 'text-muted-foreground',
    )}
  >
    {number}
  </span>
);

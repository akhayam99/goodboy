import { cn } from '@goodboy/ui';

type Props = {
  readonly className?: string;
};

export const BetaPill = ({ className }: Props) => {
  return (
    <span
      className={cn(
        'w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/15',
        className,
      )}
    >
      Beta
    </span>
  );
};

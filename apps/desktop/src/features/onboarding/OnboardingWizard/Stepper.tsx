import { cn } from '@goodboy/ui';

type Props = {
  readonly current: number;
  readonly total: number;
};

export const Stepper = ({ current, total }: Props) => {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full motion-safe:transition-all',
            i < current ? 'w-6 bg-primary' : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  );
};

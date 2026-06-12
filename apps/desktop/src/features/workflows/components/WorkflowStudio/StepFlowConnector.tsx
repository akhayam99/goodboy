import { cn } from '@goodboy/ui';
import { ArrowRight } from 'lucide-react';

type Props = {
  readonly index: number;
  readonly interior: boolean;
  readonly dragging: boolean;
  readonly active: boolean;
};

export const StepFlowConnector = ({ index, interior, dragging, active }: Props) => {
  return (
    <div
      data-dropindex={index}
      className={cn(
        'relative flex shrink-0 items-center justify-center self-stretch transition-all duration-150',
        dragging ? (active ? 'w-24' : 'w-10') : interior ? 'w-9' : 'w-0',
      )}
    >
      {dragging ? (
        active ? (
          <div className="flex flex-col items-center gap-1.5">
            <span className="h-9 w-1 rounded-full bg-primary" aria-hidden />
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium leading-none text-primary-foreground shadow-sm">
              drop here
            </span>
          </div>
        ) : (
          <span className="h-8 w-0.5 rounded-full bg-primary/25" aria-hidden />
        )
      ) : interior ? (
        <ArrowRight size={16} className="text-muted-foreground/40" aria-hidden />
      ) : null}
    </div>
  );
};

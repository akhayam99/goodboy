import { cn } from '@goodboy/ui';
import { ArrowDown, Plus } from 'lucide-react';

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
        'relative flex shrink-0 items-center justify-center self-stretch motion-safe:transition-all motion-safe:duration-150',
        // keep at least an h-4 hit slot at the leading edge so drops before the
        // first card never collapse to a zero-height, unhittable target.
        dragging ? (active ? 'h-20' : interior ? 'h-8' : 'h-6') : interior ? 'h-7' : 'h-3',
      )}
    >
      {dragging ? (
        active ? (
          <div className="flex items-center gap-2">
            <span className="h-1 w-12 rounded-full bg-primary" aria-hidden />
            <span className="rounded-full bg-primary px-2 py-0.5 text-2xs font-medium leading-none text-primary-foreground shadow-sm">
              drop here
            </span>
            <span className="h-1 w-12 rounded-full bg-primary" aria-hidden />
          </div>
        ) : (
          <span
            className="flex size-5 items-center justify-center rounded-full border border-dashed border-primary/40 text-primary/50"
            aria-hidden
          >
            <Plus size={11} />
          </span>
        )
      ) : interior ? (
        <ArrowDown size={16} className="text-muted-foreground/40" aria-hidden />
      ) : null}
    </div>
  );
};

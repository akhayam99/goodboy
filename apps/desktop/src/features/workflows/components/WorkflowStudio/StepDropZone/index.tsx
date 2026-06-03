import { cn } from '@goodboy/ui';

interface Props {
  readonly index: number;
  readonly dragging: boolean;
  readonly active: boolean;
}

export function StepDropZone({ index, dragging, active }: Props) {
  return (
    <div
      data-dropindex={index}
      className={cn(
        'relative flex items-center justify-center transition-[height] duration-150',
        !dragging ? 'h-2' : active ? 'h-8' : 'h-4',
      )}
    >
      {dragging ? (
        <>
          {active ? (
            <span className="absolute inset-x-1 inset-y-1 rounded-md bg-primary/10" aria-hidden />
          ) : null}
          <span
            aria-hidden
            className={cn(
              'absolute left-1 right-1 rounded-full transition-all duration-150',
              active ? 'h-0.5 bg-primary' : 'h-px bg-primary/25',
            )}
          />
          {active ? (
            <span className="relative z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium leading-none text-primary-foreground shadow-sm">
              drop here
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

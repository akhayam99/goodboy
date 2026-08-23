import { cn } from '@goodboy/ui';

type DotState = 'done' | 'current' | 'pending';

const DOT_CLASS: Readonly<Record<DotState, string>> = {
  done: 'w-6 bg-primary',
  current: 'w-3 bg-primary/50 ring-1 ring-primary',
  pending: 'w-1.5 bg-border',
};

const dotState = ({
  position,
  currentPosition,
}: {
  readonly position: number;
  readonly currentPosition: number;
}): DotState => {
  if (position === currentPosition) {
    return 'current';
  }
  if (position < currentPosition) {
    return 'done';
  }
  return 'pending';
};

type Props = {
  readonly current: number;
  readonly steps: ReadonlyArray<number>;
};

export const Stepper = ({ current, steps }: Props) => {
  const currentPosition = steps.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {steps.map((wizardStep, position) => {
        const state = dotState({ position, currentPosition });
        return (
          <span
            key={wizardStep}
            data-state={state}
            className={cn('h-1.5 rounded-full motion-safe:transition-all', DOT_CLASS[state])}
          />
        );
      })}
    </div>
  );
};

import { cn } from '@goodboy/ui';
import type { RunStepState } from '../../timeline/runStepProgress';

type Props = {
  readonly states: ReadonlyArray<RunStepState>;
  readonly label: string;
};

const SEGMENT_FILL: Record<RunStepState, string> = {
  done: 'bg-muted-foreground',
  running: 'bg-info',
  waiting: 'bg-warning',
  failed: 'bg-danger',
  notStarted: 'bg-border',
};

export const StepMeter = ({ states, label }: Props) => (
  <span role="img" aria-label={label} className="flex w-24 shrink-0 items-center gap-0.5">
    {states.map((state, index) => (
      <span
        key={index}
        data-step-state={state}
        className={cn('h-1 min-w-0 flex-1 rounded-full', SEGMENT_FILL[state])}
      />
    ))}
  </span>
);

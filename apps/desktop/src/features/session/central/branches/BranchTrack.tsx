import { Tooltip, cn } from '@goodboy/ui';
import type { BranchStep, BranchStepState, BranchTone } from './branchStoryOf';

type Props = {
  readonly steps: ReadonlyArray<BranchStep>;
  readonly tone: BranchTone;
};

const FILL: Record<BranchTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
};

const RING: Record<BranchTone, string> = {
  neutral: 'border-muted-foreground',
  info: 'border-info',
  warning: 'border-warning',
  danger: 'border-danger',
  success: 'border-success',
};

type DotParams = {
  readonly state: BranchStepState;
  readonly tone: BranchTone;
};

const dotClassOf = ({ state, tone }: DotParams): string => {
  switch (state) {
    case 'done':
      return 'size-2 bg-faint-foreground';
    case 'current':
      return cn('size-2', FILL[tone]);
    case 'ring':
      return cn('size-2 border-2 bg-transparent', RING[tone]);
    case 'todo':
      return 'size-2 border border-border bg-transparent';
    case 'skipped':
      return 'h-0.5 w-2 bg-border';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const BranchTrack = ({ steps, tone }: Props) => (
  <span aria-hidden className="flex shrink-0 items-center gap-1" data-branch-track="">
    {steps.map((step) => (
      <Tooltip key={step.id} content={step.name}>
        <span
          data-step={step.id}
          data-step-state={step.state}
          className={cn('shrink-0 rounded-full', dotClassOf({ state: step.state, tone }))}
        />
      </Tooltip>
    ))}
  </span>
);

import type { RunStepState } from '../../timeline/runStepProgress';

type Params = {
  readonly state: RunStepState;
};

export const stepFillOf = ({ state }: Params): string => {
  switch (state) {
    case 'running':
      return 'bg-primary motion-safe:animate-soft-pulse';
    case 'done':
      return 'bg-muted-foreground';
    case 'waiting':
      return 'bg-warning';
    case 'failed':
      return 'bg-danger';
    case 'notStarted':
      return 'bg-border';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

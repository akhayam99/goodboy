import type { StepState } from './DemoRailStep';

type Params = {
  readonly index: number;
  readonly current: number;
  readonly seen: ReadonlyArray<number>;
};

export const stepStateOf = ({ index, current, seen }: Params): StepState => {
  if (index === current) {
    return 'current';
  }
  return seen.includes(index) ? 'done' : 'todo';
};

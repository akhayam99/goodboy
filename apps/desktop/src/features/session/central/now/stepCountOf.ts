import type { LiveRunStepModel } from './liveGroupsOf';

type Params = {
  readonly steps: ReadonlyArray<LiveRunStepModel>;
};

export const stepCountOf = ({ steps }: Params): string => {
  const started = steps.filter((step) => step.state !== 'notStarted').length;
  return `${started}/${steps.length}`;
};

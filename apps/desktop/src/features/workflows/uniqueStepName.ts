import type { Step } from '@goodboy/types';

type Params = {
  readonly requested: string;
  readonly steps: ReadonlyArray<Step>;
};

export const uniqueStepName = ({ requested, steps }: Params): string => {
  const names = new Set(steps.map((step) => step.name));
  if (!names.has(requested)) {
    return requested;
  }
  let suffix = 2;
  while (names.has(`${requested} ${suffix}`)) {
    suffix += 1;
  }
  return `${requested} ${suffix}`;
};

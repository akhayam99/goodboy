import { currentStack } from './currentStack';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
};

export const leaveStudio = ({ get }: Params): void => {
  const steps = currentStack(get()).entries.length + 1;
  for (let step = 0; step < steps && get().appStudio !== null; step += 1) {
    get().closeStudio();
  }
};

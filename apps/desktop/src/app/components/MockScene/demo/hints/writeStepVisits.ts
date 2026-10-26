import { STEP_VISITS_KEY } from './stepVisitsKey';
import type { StepVisits } from './stepVisitsTypes';

type Params = {
  readonly visits: StepVisits;
};

export const writeStepVisits = ({ visits }: Params): void => {
  try {
    window.sessionStorage.setItem(STEP_VISITS_KEY, JSON.stringify(visits));
  } catch {
    return;
  }
};

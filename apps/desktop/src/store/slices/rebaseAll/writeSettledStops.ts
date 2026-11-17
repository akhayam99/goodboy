import { settledStopsMemory, type SettledStops } from './settledStopsMemory';

type WriteParams = {
  readonly stops: SettledStops;
};

export const writeSettledStops = ({ stops }: WriteParams): void => {
  if (Object.values(stops).every((ids) => ids === undefined || ids.length === 0)) {
    settledStopsMemory().clear();
    return;
  }
  settledStopsMemory().write(stops);
};

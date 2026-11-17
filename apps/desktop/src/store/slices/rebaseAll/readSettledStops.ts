import { settledStopsMemory, type SettledStops } from './settledStopsMemory';

const NONE: SettledStops = {};

type ValueParams = {
  readonly value: unknown;
};

const stopsOf = ({ value }: ValueParams): SettledStops => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return NONE;
  }
  const stops: Record<string, ReadonlyArray<string>> = {};
  for (const [sessionId, ids] of Object.entries(value)) {
    if (Array.isArray(ids)) {
      stops[sessionId] = ids.filter((id): id is string => typeof id === 'string');
    }
  }
  return stops;
};

export const readSettledStops = (): SettledStops => stopsOf({ value: settledStopsMemory().read() });

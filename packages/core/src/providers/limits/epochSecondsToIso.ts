import type { IsoDateTime } from '@goodboy/types';

type Params = {
  readonly value: unknown;
};

export const epochSecondsToIso = ({ value }: Params): IsoDateTime | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString() as IsoDateTime;
};

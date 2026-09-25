import type { IsoDateTime } from '@goodboy/types';

type Params = {
  readonly value: unknown;
};

export const epochSecondsToIso = ({ value }: Params): IsoDateTime | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString() as IsoDateTime;
};

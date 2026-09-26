import type { IsoDateTime } from '@goodboy/types';

type Params = {
  anchor: string;
};

type ShiftParams = {
  at: string;
};

type SceneClock = {
  iso: (params: ShiftParams) => IsoDateTime;
  ms: (params: ShiftParams) => number;
};

const LOADED_AT = Date.now();

export const sceneClock = ({ anchor }: Params): SceneClock => {
  const offset = LOADED_AT - Date.parse(anchor);
  const ms = ({ at }: ShiftParams): number => Date.parse(at) + offset;
  const iso = ({ at }: ShiftParams): IsoDateTime =>
    new Date(ms({ at })).toISOString() as IsoDateTime;
  return { iso, ms };
};

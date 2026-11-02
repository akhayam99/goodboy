import { brandId, type IsoDateTime } from '@goodboy/types';

type Params = {
  readonly ms: number;
};

export const isoFromMs = ({ ms }: Params): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(ms).toISOString() });

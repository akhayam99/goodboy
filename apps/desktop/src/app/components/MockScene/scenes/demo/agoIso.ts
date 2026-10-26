import { brandId, type IsoDateTime } from '@goodboy/types';
import { NOW } from '../flow-audit/fixtures';

const MINUTE_MS = 60_000;

type Params = {
  readonly minutes: number;
};

export const agoIso = ({ minutes }: Params): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(Date.parse(NOW) - minutes * MINUTE_MS).toISOString() });

import { brandId } from '../brandId';
import type { IsoDateTime } from '../ids';

export const isoNow = (): IsoDateTime => brandId<IsoDateTime>({ value: new Date().toISOString() });

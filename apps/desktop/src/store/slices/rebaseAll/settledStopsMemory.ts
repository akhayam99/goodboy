import type { SessionId } from '@goodboy/types';
import { STORAGE_KEYS, persistedPref } from '../../../shared/lib/storage-keys';

export type SettledStops = Readonly<Record<SessionId, ReadonlyArray<string> | undefined>>;

export const settledStopsMemory = () =>
  persistedPref<unknown>({
    key: STORAGE_KEYS.settledRebaseStops,
    fallback: null,
    parse: JSON.parse,
    area: 'session',
  });

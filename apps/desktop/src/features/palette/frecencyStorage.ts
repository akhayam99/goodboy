import { STORAGE_KEYS, persistedPref } from '../../shared/lib/storage-keys';
import { EMPTY_FRECENCY, parseFrecency, recordUse, type FrecencyState } from './frecency';

type RecordParams = {
  readonly key: string;
  readonly now: number;
};

const frecencyPref = persistedPref<FrecencyState>({
  key: STORAGE_KEYS.paletteFrecency,
  parse: parseFrecency,
  fallback: EMPTY_FRECENCY,
});

export const readFrecency = frecencyPref.read;

export const recordPaletteUse = ({ key, now }: RecordParams): void =>
  frecencyPref.write(recordUse({ state: frecencyPref.read(), key, now }));

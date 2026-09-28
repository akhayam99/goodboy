import { STORAGE_KEYS } from '../../shared/lib/storage-keys';
import { EMPTY_FRECENCY, parseFrecency, recordUse, type FrecencyState } from './frecency';

type RecordParams = {
  readonly key: string;
  readonly now: number;
};

export const readFrecency = (): FrecencyState => {
  try {
    return parseFrecency(localStorage.getItem(STORAGE_KEYS.paletteFrecency));
  } catch {
    return EMPTY_FRECENCY;
  }
};

export const recordPaletteUse = ({ key, now }: RecordParams): void => {
  try {
    const next = recordUse({ state: readFrecency(), key, now });
    localStorage.setItem(STORAGE_KEYS.paletteFrecency, JSON.stringify(next));
  } catch {
    return;
  }
};

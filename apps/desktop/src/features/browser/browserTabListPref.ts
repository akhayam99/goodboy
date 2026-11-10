import { STORAGE_KEYS, persistedPref } from '../../shared/lib/storage-keys';
import type { BrowserTabListMode } from './types';

type ModeParams = {
  readonly mode: BrowserTabListMode;
};

type ValueParams = {
  readonly value: unknown;
};

const stored = persistedPref<unknown>({
  key: STORAGE_KEYS.browserTabList,
  parse: JSON.parse,
  fallback: false,
});

const modeOf = ({ value }: ValueParams): BrowserTabListMode => {
  if (value === true || value === 'list') {
    return 'list';
  }
  return value === 'rail' ? 'rail' : 'hidden';
};

export const browserTabListPref = {
  read: (): BrowserTabListMode => modeOf({ value: stored.read() }),
  write: ({ mode }: ModeParams): void => stored.write(mode),
  clear: (): void => stored.clear(),
};

import { matchesWords } from './matchesWords';
import type { BrowserConsoleEntry, BrowserConsoleKind } from './types';

export type ConsoleLevelFilter = 'all' | 'error' | 'warn' | 'info';

type Params = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly kind: BrowserConsoleKind;
  readonly level: ConsoleLevelFilter;
  readonly query: string;
};

type LevelParams = {
  readonly entry: BrowserConsoleEntry;
  readonly level: ConsoleLevelFilter;
};

const isLevelShown = ({ entry, level }: LevelParams): boolean => {
  if (level === 'all') {
    return true;
  }
  if (level === 'info') {
    return entry.level === 'info' || entry.level === 'log';
  }
  return entry.level === level;
};

export const consoleRowsOf = ({
  entries,
  kind,
  level,
  query,
}: Params): ReadonlyArray<BrowserConsoleEntry> => {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
  return entries.filter(
    (entry) =>
      entry.kind === kind &&
      isLevelShown({ entry, level }) &&
      matchesWords({
        words,
        fields: [entry.text, entry.source ?? '', entry.method ?? '', String(entry.status ?? '')],
      }),
  );
};

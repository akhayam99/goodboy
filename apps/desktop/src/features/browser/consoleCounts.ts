import type { BrowserConsoleEntry, BrowserConsoleKind } from './types';

type ConsoleCounts = Readonly<Record<BrowserConsoleKind, number>>;

type Params = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
};

export const consoleCounts = ({ entries }: Params): ConsoleCounts =>
  entries.reduce<ConsoleCounts>(
    (counts, entry) => ({ ...counts, [entry.kind]: counts[entry.kind] + 1 }),
    { console: 0, network: 0 },
  );

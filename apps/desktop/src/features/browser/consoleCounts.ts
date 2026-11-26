import { consoleTabOf } from './consoleTabOf';
import type { BrowserConsoleEntry, BrowserToolsTab } from './types';

type ConsoleCounts = Readonly<Record<BrowserToolsTab, number>>;

type Params = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
};

export const consoleCounts = ({ entries }: Params): ConsoleCounts =>
  entries.reduce<ConsoleCounts>(
    (counts, entry) => {
      const tab = consoleTabOf({ entry });
      const errors = entry.kind === 'error' ? counts.errors + 1 : counts.errors;
      return tab === null ? { ...counts, errors } : { ...counts, [tab]: counts[tab] + 1, errors };
    },
    { console: 0, network: 0, errors: 0 },
  );

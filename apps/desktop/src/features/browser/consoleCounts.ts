import { consoleTabOf } from './consoleTabOf';
import type { BrowserConsoleEntry, BrowserConsoleKind } from './types';

type ConsoleCounts = Readonly<Record<BrowserConsoleKind, number>>;

type Params = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
};

export const consoleCounts = ({ entries }: Params): ConsoleCounts =>
  entries.reduce<ConsoleCounts>(
    (counts, entry) => {
      const tab = consoleTabOf({ entry });
      return tab === null ? counts : { ...counts, [tab]: counts[tab] + 1 };
    },
    { console: 0, network: 0 },
  );

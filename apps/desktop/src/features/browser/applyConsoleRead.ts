import type { BrowserConsoleEntry, BrowserConsoleRead } from './types';

export const CONSOLE_KEPT_ROWS = 500;

const SILENT_AFTER_MISSES = 2;

export type ConsoleFailure = 'read' | 'silent';

export type ConsoleCursor = {
  readonly doc: string | null;
  readonly after: number;
};

export type TabConsole = ConsoleCursor & {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly hasLogged: boolean;
  readonly misses: number;
  readonly failure: ConsoleFailure | null;
};

export const EMPTY_TAB_CONSOLE: TabConsole = {
  doc: null,
  after: 0,
  entries: [],
  hasLogged: false,
  misses: 0,
  failure: null,
};

type Params = {
  readonly current: TabConsole;
  readonly sent: ConsoleCursor;
  readonly answer: BrowserConsoleRead;
};

type EntriesParams = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
};

const newest = ({ entries }: EntriesParams): ReadonlyArray<BrowserConsoleEntry> =>
  entries.length > CONSOLE_KEPT_ROWS ? entries.slice(entries.length - CONSOLE_KEPT_ROWS) : entries;

export const applyConsoleRead = ({ current, sent, answer }: Params): TabConsole | null => {
  if (current.doc !== sent.doc || current.after !== sent.after) {
    return null;
  }
  if (!answer.isHeard) {
    const misses = current.misses + 1;
    const isSilent = current.hasLogged && misses >= SILENT_AFTER_MISSES;
    return { ...current, misses, failure: isSilent ? 'silent' : null };
  }
  const isNewLoad = answer.doc !== current.doc;
  const fresh = answer.entries.filter((entry) => isNewLoad || entry.seq > current.after);
  const after = fresh.reduce(
    (last, entry) => Math.max(last, entry.seq),
    isNewLoad ? 0 : current.after,
  );
  return {
    doc: answer.doc,
    after,
    entries: newest({ entries: isNewLoad ? fresh : [...current.entries, ...fresh] }),
    hasLogged: (isNewLoad ? false : current.hasLogged) || fresh.length > 0,
    misses: 0,
    failure: null,
  };
};

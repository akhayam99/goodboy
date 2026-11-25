import type { BrowserConsoleEntry, BrowserConsoleRead, BrowserEntryKind } from './types';

export const CONSOLE_KEPT_ROWS = {
  console: 500,
  network: 300,
  error: 100,
} as const satisfies Record<BrowserEntryKind, number>;

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

type MergeParams = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly fresh: ReadonlyArray<BrowserConsoleEntry>;
};

const newest = ({ entries }: EntriesParams): ReadonlyArray<BrowserConsoleEntry> => {
  const seen = { console: 0, network: 0, error: 0 };
  return [...entries]
    .reverse()
    .filter((entry) => {
      seen[entry.kind] += 1;
      return seen[entry.kind] <= CONSOLE_KEPT_ROWS[entry.kind];
    })
    .reverse();
};

const withUpdates = ({ entries, fresh }: MergeParams): ReadonlyArray<BrowserConsoleEntry> => {
  const updates = new Map<string, BrowserConsoleEntry>();
  fresh.forEach((entry) => {
    if (entry.network !== null) {
      updates.set(entry.network.id, entry);
    }
  });
  const placed = new Set<string>();
  const kept = entries.map((entry) => {
    const update = entry.network === null ? undefined : updates.get(entry.network.id);
    if (update === undefined || entry.network === null) {
      return entry;
    }
    placed.add(entry.network.id);
    return update;
  });
  const added = fresh.filter((entry) => entry.network === null || !placed.has(entry.network.id));
  return [...kept, ...added];
};

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
    entries: newest({
      entries: withUpdates({ entries: isNewLoad ? [] : current.entries, fresh }),
    }),
    hasLogged: (isNewLoad ? false : current.hasLogged) || fresh.length > 0,
    misses: 0,
    failure: null,
  };
};

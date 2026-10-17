export const INNER_COLUMN_SHORTCUT = 'innerColumn.toggle';

export type InnerColumn = {
  readonly id: string;
  readonly label: string;
  readonly toggle: () => void;
};

type AddParams = {
  readonly column: InnerColumn;
};

type KeyParams = {
  readonly key: number;
};

type RenameParams = KeyParams & {
  readonly label: string;
};

type Entry = KeyParams & {
  readonly column: InnerColumn;
};

let entries: ReadonlyArray<Entry> = [];
let lastKey = 0;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const innerColumnStore = {
  add: ({ column }: AddParams): number => {
    lastKey += 1;
    const key = lastKey;
    entries = [...entries, { key, column }];
    notify();
    return key;
  },
  remove: ({ key }: KeyParams): void => {
    entries = entries.filter((entry) => entry.key !== key);
    notify();
  },
  rename: ({ key, label }: RenameParams): void => {
    const entry = entries.find((candidate) => candidate.key === key);
    if (entry === undefined || entry.column.label === label) {
      return;
    }
    entries = entries.map((candidate) =>
      candidate.key === key ? { key, column: { ...candidate.column, label } } : candidate,
    );
    notify();
  },
  current: (): InnerColumn | null => entries.at(-1)?.column ?? null,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  toggleCurrent: (): boolean => {
    const column = entries.at(-1)?.column ?? null;
    if (column === null) {
      return false;
    }
    column.toggle();
    return true;
  },
};

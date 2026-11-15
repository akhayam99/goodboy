import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { createSerialQueue } from '../../../../store/runtime/state-writes/serialQueue';

export type RowFailure = {
  readonly value: unknown;
  readonly retry: () => Promise<void>;
};

type KeyParams = {
  readonly key: string;
};

type FailParams = KeyParams & {
  readonly failure: RowFailure;
};

type ListenParams = {
  readonly listener: () => void;
};

const failures = new Map<string, RowFailure>();
const openRows = new Map<string, number>();
const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

const clear = ({ key }: KeyParams): void => {
  if (failures.delete(key)) {
    notify();
  }
};

export const rowSaves = {
  latest: createLatestOnly(),
  writes: createSerialQueue(),
  failureOf: ({ key }: KeyParams): RowFailure | null => failures.get(key) ?? null,
  fail: ({ key, failure }: FailParams): void => {
    failures.set(key, failure);
    notify();
  },
  clear,
  isOpen: ({ key }: KeyParams): boolean => (openRows.get(key) ?? 0) > 0,
  open: ({ key }: KeyParams): void => {
    openRows.set(key, (openRows.get(key) ?? 0) + 1);
  },
  close: ({ key }: KeyParams): void => {
    const left = (openRows.get(key) ?? 1) - 1;
    if (left > 0) {
      openRows.set(key, left);
      return;
    }
    openRows.delete(key);
    clear({ key });
  },
  subscribe: ({ listener }: ListenParams): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

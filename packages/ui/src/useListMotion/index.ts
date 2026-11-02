import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../prefersReducedMotion';
import { DURATION_BASE_MS, DURATION_QUICK_MS } from '../motionTimings';

export const LIST_MOTION_MAX_BATCH = 20;

export type ListMotionPhase = 'stable' | 'entering' | 'leaving' | 'collapsing';

export type ListMotionItem<T> = {
  readonly key: string;
  readonly value: T;
};

export type ListMotionEntry<T> = ListMotionItem<T> & {
  readonly phase: ListMotionPhase;
};

type Params<T> = {
  readonly items: ReadonlyArray<ListMotionItem<T>>;
  readonly resetKey: string;
};

type Leaving<T> = ListMotionItem<T> & {
  readonly index: number;
  readonly status: 'leaving' | 'collapsing';
};

type MotionState<T> = {
  readonly resetKey: string;
  readonly keys: ReadonlyArray<string>;
  readonly values: ReadonlyMap<string, T>;
  readonly entering: ReadonlySet<string>;
  readonly leaving: ReadonlyArray<Leaving<T>>;
};

const stateOf = <T>({ items, resetKey }: Params<T>): MotionState<T> => ({
  resetKey,
  keys: items.map((item) => item.key),
  values: new Map(items.map((item) => [item.key, item.value])),
  entering: new Set(),
  leaving: [],
});

type SameKeysParams = {
  readonly left: ReadonlyArray<string>;
  readonly right: ReadonlyArray<string>;
};

const sameKeys = ({ left, right }: SameKeysParams): boolean =>
  left.length === right.length && left.every((key, index) => key === right[index]);

type NextStateParams<T> = Params<T> & {
  readonly state: MotionState<T>;
};

const nextStateOf = <T>({ state, items, resetKey }: NextStateParams<T>): MotionState<T> => {
  const keys = items.map((item) => item.key);
  if (state.resetKey === resetKey && sameKeys({ left: keys, right: state.keys })) {
    return state;
  }
  if (state.resetKey !== resetKey || prefersReducedMotion()) {
    return stateOf({ items, resetKey });
  }
  const current = new Set(keys);
  const previous = new Set(state.keys);
  const added = keys.filter((key) => !previous.has(key));
  const removed = state.keys.filter((key) => !current.has(key));
  if (added.length + removed.length > LIST_MOTION_MAX_BATCH) {
    return stateOf({ items, resetKey });
  }
  const values = new Map(items.map((item) => [item.key, item.value]));
  const enteringKeys = new Set([...state.entering, ...added].filter((key) => current.has(key)));
  const survivors = state.leaving.filter((entry) => !current.has(entry.key));
  const leaving = [
    ...survivors,
    ...removed.flatMap((key) => {
      const value = state.values.get(key);
      return value === undefined
        ? []
        : [{ key, value, index: state.keys.indexOf(key), status: 'leaving' as const }];
    }),
  ];
  return { resetKey, keys, values, entering: enteringKeys, leaving };
};

export const useListMotion = <T>({
  items,
  resetKey,
}: Params<T>): ReadonlyArray<ListMotionEntry<T>> => {
  const [state, setState] = useState<MotionState<T>>(() => stateOf({ items, resetKey }));
  const next = nextStateOf({ state, items, resetKey });
  if (next !== state) {
    setState(next);
  }
  const { entering, leaving } = next;

  useEffect(() => {
    if (entering.size === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setState((prev) => ({ ...prev, entering: new Set() })),
      DURATION_BASE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [entering]);

  const hasFading = leaving.some((entry) => entry.status === 'leaving');
  const hasCollapsing = leaving.some((entry) => entry.status === 'collapsing');

  useEffect(() => {
    if (!hasFading) {
      return;
    }
    const timer = window.setTimeout(
      () =>
        setState((prev) => ({
          ...prev,
          leaving: prev.leaving.map((entry) => ({ ...entry, status: 'collapsing' as const })),
        })),
      DURATION_QUICK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hasFading, leaving]);

  useEffect(() => {
    if (!hasCollapsing) {
      return;
    }
    const timer = window.setTimeout(
      () =>
        setState((prev) => ({
          ...prev,
          leaving: prev.leaving.filter((entry) => entry.status !== 'collapsing'),
        })),
      DURATION_BASE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hasCollapsing]);

  const rendered: Array<ListMotionEntry<T>> = items.map((item) => ({
    ...item,
    phase: entering.has(item.key) ? 'entering' : 'stable',
  }));
  [...leaving]
    .sort((a, b) => a.index - b.index)
    .forEach((entry) => {
      rendered.splice(Math.min(entry.index, rendered.length), 0, {
        key: entry.key,
        value: entry.value,
        phase: entry.status,
      });
    });
  return rendered;
};

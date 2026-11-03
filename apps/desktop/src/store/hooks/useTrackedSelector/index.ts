import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { runTracked } from './runTracked';

type Memo<S extends object, U> = {
  readonly selector: (state: S) => U;
  state: S;
  readonly value: U;
  readonly keys: ReadonlySet<PropertyKey> | null;
};

type KeysParams<S extends object> = {
  readonly keys: ReadonlySet<PropertyKey>;
  readonly previous: S;
  readonly next: S;
};

const areKeysUnchanged = <S extends object>({ keys, previous, next }: KeysParams<S>): boolean => {
  for (const key of keys) {
    if (!Object.is(Reflect.get(previous, key), Reflect.get(next, key))) {
      return false;
    }
  }
  return true;
};

type Params<S extends object, U> = {
  readonly api: StoreApi<S>;
  readonly selector: (state: S) => U;
};

export const useTrackedSelector = <S extends object, U>({ api, selector }: Params<S, U>): U => {
  const memoRef = useRef<Memo<S, U> | null>(null);
  const getSnapshot = useCallback((): U => {
    const state = api.getState();
    const memo = memoRef.current;
    if (memo !== null && memo.selector === selector) {
      if (memo.state === state) {
        return memo.value;
      }
      if (
        memo.keys !== null &&
        areKeysUnchanged({ keys: memo.keys, previous: memo.state, next: state })
      ) {
        memo.state = state;
        return memo.value;
      }
    }
    const { value, keys } = runTracked({ selector, state });
    memoRef.current = { selector, state, value, keys };
    return value;
  }, [api, selector]);
  return useSyncExternalStore(api.subscribe, getSnapshot, () => selector(api.getInitialState()));
};

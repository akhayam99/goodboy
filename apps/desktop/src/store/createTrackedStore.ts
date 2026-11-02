import type { StoreApi } from 'zustand';
import { useTrackedSelector } from './hooks/useTrackedSelector';

type Params<S extends object> = {
  readonly api: StoreApi<S>;
};

export type TrackedStore<S extends object> = (<U>(selector: (state: S) => U) => U) & StoreApi<S>;

export const createTrackedStore = <S extends object>({ api }: Params<S>): TrackedStore<S> =>
  Object.assign(<U>(selector: (state: S) => U) => useTrackedSelector({ api, selector }), api);

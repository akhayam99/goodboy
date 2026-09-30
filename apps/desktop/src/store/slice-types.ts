import type { AppStore } from './store';

export type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
export type GetFn = () => AppStore;

export type SliceDeps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

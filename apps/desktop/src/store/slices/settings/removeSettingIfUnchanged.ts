import { deleteSettingIfUnchanged } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly key: string;
  readonly expected: string;
};

export const removeSettingIfUnchanged = (set: SetFn) => {
  return async ({ key, expected }: Params): Promise<boolean> => {
    const isRemoved = await deleteSettingIfUnchanged({ db: tauriDatabase, key, expected });
    if (!isRemoved) {
      return false;
    }
    set((state) => ({
      settings: Object.fromEntries(Object.entries(state.settings).filter(([name]) => name !== key)),
    }));
    return true;
  };
};

import { registerWorktreeRoot } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly repoRoot: string;
};

export const scanStorageRepository = (_set: SetFn, get: GetFn) => {
  return async ({ repoRoot }: Params): Promise<void> => {
    const trimmed = repoRoot.replace(/\/+$/, '');
    if (trimmed === '') {
      return;
    }
    await registerWorktreeRoot({ db: tauriDatabase, repoRoot: trimmed, addedBy: 'user' });
    await get().loadStorage();
  };
};

import { registerWorktreeRoot } from '@goodboy/db';
import type { WorktreeRootSource } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly repoRoot: string;
  readonly addedBy: WorktreeRootSource;
};

export const rememberWorktreeRoot = async ({ repoRoot, addedBy }: Params): Promise<void> => {
  try {
    await registerWorktreeRoot({ db: tauriDatabase, repoRoot, addedBy });
  } catch {
    return;
  }
};

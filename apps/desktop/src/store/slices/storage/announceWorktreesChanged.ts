import { CHECK_STATE } from '../notifications/errorRecovery';
import { worktreesChannel } from '../../../features/storage/worktreesChannel';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly repoRoots: ReadonlyArray<string>;
};

export const announceWorktreesChanged = async ({ get, repoRoots }: Params): Promise<void> => {
  try {
    await worktreesChannel.announce({ repoRoots });
  } catch (error) {
    await get().reportError({
      recovery: CHECK_STATE,
      title: "Couldn't tell the other windows about the worktrees",
      error,
    });
  }
};

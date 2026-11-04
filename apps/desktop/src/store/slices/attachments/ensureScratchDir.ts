import type { SessionId } from '@goodboy/types';
import { scratchDirPrepare } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const ensureScratchDir = async ({ set, get, sessionId }: Params): Promise<string> => {
  const known = get().sessionScratchDirs[sessionId];
  if (known !== undefined) {
    return known;
  }
  const dir = await scratchDirPrepare({ sessionId });
  set((state) => ({ sessionScratchDirs: { ...state.sessionScratchDirs, [sessionId]: dir } }));
  return dir;
};

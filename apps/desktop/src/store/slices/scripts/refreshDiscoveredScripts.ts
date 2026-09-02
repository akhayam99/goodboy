import type { SessionId } from '@goodboy/types';
import { scanDiscoveredScripts } from './scanDiscoveredScripts';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
};

export const refreshDiscoveredScripts = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, worktreePath }: Params): Promise<void> => {
    await scanDiscoveredScripts({ set, get, sessionId, worktreePath, force: true });
  };
};

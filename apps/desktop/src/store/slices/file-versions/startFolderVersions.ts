import { formatError } from '@goodboy/ui';
import { recoverStagedFolderTurns } from './recoverStagedFolderTurns';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  nowMs: number;
}>;

export const startFolderVersions = async ({ set, get, nowMs }: Params): Promise<void> => {
  try {
    await recoverStagedFolderTurns({
      set,
      get,
      nowMs,
      onFailure: async ({ sessionId, runId, message }) => {
        await get().emitNotification({
          kind: 'error',
          severity: 'warning',
          title: "Changes from an earlier turn couldn't be saved",
          body: `session: ${sessionId}. run: ${runId}. details: ${message}`,
          sessionId,
        });
      },
    });
    await get().pruneFolderVersions({ nowMs });
  } catch (error) {
    await get().emitNotification({
      kind: 'error',
      severity: 'warning',
      title: "Saved versions couldn't be checked at startup",
      body: formatError(error),
    });
  }
};

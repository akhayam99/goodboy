import { listDiffCommentsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const refreshNotes = async ({ set, get, sessionId }: Params): Promise<void> => {
  const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
  set((state) => ({
    diffComments: { ...state.diffComments, [sessionId]: comments },
  }));
  await get().syncNoteThreads({ sessionId });
};

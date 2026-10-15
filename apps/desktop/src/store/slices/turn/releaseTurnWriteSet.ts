import type { SessionId } from '@goodboy/types';
import { releaseWriteSet } from '../../../features/worktree/worktree';
import type { GetFn, TurnLease } from './types';
import { writerWaiters } from './writerWaiters';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  lease: TurnLease;
}>;

export const releaseTurnWriteSet = async ({ get, sessionId, lease }: Params): Promise<void> => {
  const { writeSet, writeSetHolder } = lease;
  if (writeSet.length === 0 || writeSetHolder === null) {
    return;
  }
  lease.writeSet = [];
  lease.writeSetHolder = null;
  try {
    await releaseWriteSet({ entries: writeSet, holder: writeSetHolder });
  } catch (error) {
    void get().reportError({
      title: "Couldn't release the folders this turn held",
      error,
      severity: 'warning',
      sessionId,
    });
  }
  writerWaiters.wake();
};

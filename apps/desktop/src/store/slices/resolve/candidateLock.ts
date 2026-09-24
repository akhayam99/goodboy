import { acquireWorktreeWriter, releaseWorktreeWriter } from '../../../features/worktree/worktree';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';

type RunParams<T> = {
  readonly worktreePath: string;
  readonly holder: string;
  readonly run: () => Promise<T>;
};

const queue = createKeyedQueue();

export const CANDIDATE_WRITER_BUSY = 'Another writer holds this worktree';

const runExclusively = async <T>({ worktreePath, holder, run }: RunParams<T>): Promise<T> => {
  const lease = await acquireWorktreeWriter({ path: worktreePath, holder });
  if (!lease.isGranted) {
    throw new Error(CANDIDATE_WRITER_BUSY);
  }
  try {
    return await run();
  } finally {
    await releaseWorktreeWriter({ path: worktreePath, holder }).catch(() => undefined);
  }
};

export const withCandidateLock = <T>({ worktreePath, holder, run }: RunParams<T>): Promise<T> =>
  queue.run({ key: worktreePath, task: () => runExclusively({ worktreePath, holder, run }) });

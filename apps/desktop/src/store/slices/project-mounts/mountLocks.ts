import { createKeyedQueue } from '../../../shared/utils/keyedQueue';

type LockParams<T> = {
  readonly key: string;
  readonly run: () => Promise<T>;
};

const queue = createKeyedQueue();

export const withMountLock = <T>({ key, run }: LockParams<T>): Promise<T> =>
  queue.run({ key, task: run });

type RepoLockParams<T> = {
  readonly repoRoot: string;
  readonly mountKey: string;
  readonly run: () => Promise<T>;
};

export const withRepositoryAndMountLock = async <T>({
  repoRoot,
  mountKey,
  run,
}: RepoLockParams<T>): Promise<T> =>
  withMountLock({
    key: `repo:${repoRoot}`,
    run: () => withMountLock({ key: `mount:${mountKey}`, run }),
  });

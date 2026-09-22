import {
  acquireWriterLease,
  releaseWriterLease,
  repositoryWriterResource,
} from '../../../features/worktree/writerLease';

type LockParams<T> = {
  readonly key: string;
  readonly run: () => Promise<T>;
};

const chains = new Map<string, Promise<void>>();

export const withMountLock = async <T>({ key, run }: LockParams<T>): Promise<T> => {
  const previous = chains.get(key) ?? Promise.resolve();
  const result = previous.then(run, run);
  const guard = result.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, guard);
  void guard.then(() => {
    if (chains.get(key) === guard) {
      chains.delete(key);
    }
  });
  return result;
};

type RepoLockParams<T> = {
  readonly repoRoot: string;
  readonly mountKey: string;
  readonly run: () => Promise<T>;
};

const withRepositoryWriterLease = async <T>({
  repoRoot,
  mountKey,
  run,
}: RepoLockParams<T>): Promise<T> => {
  const lease = await acquireWriterLease({
    holder: `mount:${mountKey}`,
    resources: [repositoryWriterResource({ repoRoot })],
  });
  switch (lease.outcome) {
    case 'denied': {
      throw new Error(
        `a managed writer already holds ${lease.blockedResource} (${lease.blockedState}): ${lease.blockedBy}`,
      );
    }
    case 'unavailable': {
      return run();
    }
    case 'granted': {
      try {
        return await run();
      } finally {
        await releaseWriterLease({ token: lease.token });
      }
    }
    default: {
      const exhaustive: never = lease;
      return exhaustive;
    }
  }
};

export const withRepositoryAndMountLock = async <T>({
  repoRoot,
  mountKey,
  run,
}: RepoLockParams<T>): Promise<T> =>
  withMountLock({
    key: `repo:${repoRoot}`,
    run: () =>
      withMountLock({
        key: `mount:${mountKey}`,
        run: () => withRepositoryWriterLease({ repoRoot, mountKey, run }),
      }),
  });

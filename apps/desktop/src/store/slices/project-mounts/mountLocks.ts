import {
  acquireOwnedWriterLease,
  acquireWriterLease,
  releaseWriterLease,
  repositoryWriterResource,
  type OwnedReservation,
  type WriterLeaseOutcome,
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
  readonly ownedReservations?: ReadonlyArray<OwnedReservation>;
  readonly run: () => Promise<T>;
};

type RepositoryLeaseParams = {
  readonly repoRoot: string;
  readonly mountKey: string;
  readonly ownedReservations: ReadonlyArray<OwnedReservation>;
};

const acquireRepositoryLease = async ({
  repoRoot,
  mountKey,
  ownedReservations,
}: RepositoryLeaseParams): Promise<WriterLeaseOutcome> => {
  const holder = `mount:${mountKey}`;
  const resources = [repositoryWriterResource({ repoRoot })];
  if (ownedReservations.length === 0) {
    return acquireWriterLease({ holder, resources });
  }
  const owned = await acquireOwnedWriterLease({ holder, resources, owners: ownedReservations });
  switch (owned.outcome) {
    case 'granted': {
      return { outcome: 'granted', token: owned.token };
    }
    case 'denied': {
      return owned;
    }
    case 'refused': {
      throw new Error(`the owned mount operation was refused: ${owned.reason}`);
    }
    default: {
      const exhaustive: never = owned;
      return exhaustive;
    }
  }
};

const withRepositoryWriterLease = async <T>({
  repoRoot,
  mountKey,
  ownedReservations = [],
  run,
}: RepoLockParams<T>): Promise<T> => {
  const lease = await acquireRepositoryLease({ repoRoot, mountKey, ownedReservations });
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
  ownedReservations,
  run,
}: RepoLockParams<T>): Promise<T> =>
  withMountLock({
    key: `repo:${repoRoot}`,
    run: () =>
      withMountLock({
        key: `mount:${mountKey}`,
        run: () =>
          withRepositoryWriterLease({
            repoRoot,
            mountKey,
            run,
            ...(ownedReservations !== undefined && { ownedReservations }),
          }),
      }),
  });

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { acquireSpy, acquireOwnedSpy, releaseSpy } = vi.hoisted(() => ({
  acquireSpy: vi.fn(),
  acquireOwnedSpy: vi.fn(),
  releaseSpy: vi.fn(),
}));

vi.mock('../../../features/worktree/writerLease', () => ({
  acquireWriterLeaseWaiting: acquireSpy,
  acquireOwnedWriterLease: acquireOwnedSpy,
  releaseWriterLease: releaseSpy,
  repositoryWriterResource: ({ repoRoot }: { readonly repoRoot: string }) => `repo:${repoRoot}`,
}));

import { withRepositoryAndMountLock } from './mountLocks';

describe('withRepositoryAndMountLock', () => {
  beforeEach(() => {
    acquireSpy.mockReset();
    acquireOwnedSpy.mockReset();
    releaseSpy.mockReset();
    releaseSpy.mockResolvedValue(true);
  });

  it('leases the repository around a managed git mutation and releases it after', async () => {
    acquireSpy.mockResolvedValue({ outcome: 'granted', token: 'token-1' });

    const result = await withRepositoryAndMountLock({
      repoRoot: '/repo/api',
      mountKey: 'mount-1',
      run: async () => 'done',
    });

    expect(result).toBe('done');
    expect(acquireSpy).toHaveBeenCalledWith({
      holder: 'mount:mount-1',
      resources: ['repo:/repo/api'],
    });
    expect(releaseSpy).toHaveBeenCalledWith({ token: 'token-1' });
  });

  it('releases the lease when the mutation throws', async () => {
    acquireSpy.mockResolvedValue({ outcome: 'granted', token: 'token-2' });

    await expect(
      withRepositoryAndMountLock({
        repoRoot: '/repo/api',
        mountKey: 'mount-2',
        run: async () => {
          throw new Error('worktree removal failed');
        },
      }),
    ).rejects.toThrow('worktree removal failed');

    expect(releaseSpy).toHaveBeenCalledWith({ token: 'token-2' });
  });

  it('refuses the mutation while another managed writer holds the repository', async () => {
    acquireSpy.mockResolvedValue({
      outcome: 'denied',
      blockedBy: 'run-7',
      blockedState: 'active',
      blockedResource: 'repo:/repo/api',
    });
    const run = vi.fn(async () => 'never');

    await expect(
      withRepositoryAndMountLock({ repoRoot: '/repo/api', mountKey: 'mount-3', run }),
    ).rejects.toThrow('a managed writer already holds repo:/repo/api (active): run-7');

    expect(run).not.toHaveBeenCalled();
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  it('keeps the promise lock as the only serializer when the backend cannot answer', async () => {
    acquireSpy.mockResolvedValue({ outcome: 'unavailable' });

    const result = await withRepositoryAndMountLock({
      repoRoot: '/repo/api',
      mountKey: 'mount-4',
      run: async () => 'done',
    });

    expect(result).toBe('done');
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  it('takes the repository through the owned path when the caller presents its reservations', async () => {
    acquireOwnedSpy.mockResolvedValue({ outcome: 'granted', leaseId: 'op-1', token: 'token-op' });
    const owners = [{ leaseId: 'lease-attempt-1', token: 'secret-1' }];

    const result = await withRepositoryAndMountLock({
      repoRoot: '/repo/api',
      mountKey: 'session:attempt:2',
      ownedReservations: owners,
      run: async () => 'allocated',
    });

    expect(result).toBe('allocated');
    expect(acquireSpy).not.toHaveBeenCalled();
    expect(acquireOwnedSpy).toHaveBeenCalledWith({
      holder: 'mount:session:attempt:2',
      resources: ['repo:/repo/api'],
      owners,
    });
    expect(releaseSpy).toHaveBeenCalledWith({ token: 'token-op' });
  });

  it('refuses the mutation when a foreign holder still blocks the owned path', async () => {
    acquireOwnedSpy.mockResolvedValue({
      outcome: 'denied',
      blockedBy: 'run-foreign',
      blockedState: 'active',
      blockedResource: 'tree:/repo/api|/repo/api/other',
    });
    const run = vi.fn(async () => 'never');

    await expect(
      withRepositoryAndMountLock({
        repoRoot: '/repo/api',
        mountKey: 'session:attempt:3',
        ownedReservations: [{ leaseId: 'lease-attempt-1', token: 'secret-1' }],
        run,
      }),
    ).rejects.toThrow(/run-foreign/);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses the mutation when the presented ownership does not authenticate', async () => {
    acquireOwnedSpy.mockResolvedValue({ outcome: 'refused', reason: 'forged token' });
    const run = vi.fn(async () => 'never');

    await expect(
      withRepositoryAndMountLock({
        repoRoot: '/repo/api',
        mountKey: 'session:attempt:4',
        ownedReservations: [{ leaseId: 'lease-attempt-1', token: 'forged' }],
        run,
      }),
    ).rejects.toThrow(/forged token/);
    expect(run).not.toHaveBeenCalled();
  });
});

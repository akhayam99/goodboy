import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import {
  acquireWriterLease,
  acquireWriterLeaseWaiting,
  listUnknownWriterLeases,
  releaseWriterLease,
  repositoryWriterResource,
  worktreeWriterResource,
} from './writerLease';

describe('writer lease bridge', () => {
  beforeEach(() => {
    invokeSpy.mockReset();
  });

  it('names a repository and a checkout as distinct resources', () => {
    expect(repositoryWriterResource({ repoRoot: '/repo/api' })).toBe('repo:/repo/api');
    expect(
      worktreeWriterResource({ repoRoot: '/repo/api', worktreePath: '/repo/api/wt/one' }),
    ).toBe('tree:/repo/api|/repo/api/wt/one');
  });

  it('reports a grant with the token the backend issued', async () => {
    invokeSpy.mockResolvedValue({
      id: 'lease-1',
      holder: 'mount:one',
      token: 'token-1',
      isGranted: true,
      blockedBy: null,
      blockedState: null,
      blockedResource: null,
    });

    const outcome = await acquireWriterLease({
      holder: 'mount:one',
      resources: ['repo:/repo/api'],
      runId: 'run-1',
    });

    expect(outcome).toEqual({ outcome: 'granted', token: 'token-1' });
    expect(invokeSpy).toHaveBeenCalledWith('writer_lease_acquire', {
      holder: 'mount:one',
      resources: ['repo:/repo/api'],
      runId: 'run-1',
    });
  });

  it('surfaces the holder and the state that blocked the request', async () => {
    invokeSpy.mockResolvedValue({
      id: null,
      holder: 'mount:two',
      token: null,
      isGranted: false,
      blockedBy: 'run-9',
      blockedState: 'unknown',
      blockedResource: 'repo:/repo/api',
    });

    const outcome = await acquireWriterLease({
      holder: 'mount:two',
      resources: ['repo:/repo/api'],
    });

    expect(outcome).toEqual({
      outcome: 'denied',
      blockedBy: 'run-9',
      blockedState: 'unknown',
      blockedResource: 'repo:/repo/api',
    });
  });

  it('waits through contention on the backend queue instead of failing on the first denial', async () => {
    invokeSpy.mockResolvedValue({
      id: 'lease-3',
      holder: 'mount:four',
      token: 'token-3',
      isGranted: true,
      blockedBy: null,
      blockedState: null,
      blockedResource: null,
    });

    const outcome = await acquireWriterLeaseWaiting({
      holder: 'mount:four',
      resources: ['repo:/repo/api'],
    });

    expect(outcome).toEqual({ outcome: 'granted', token: 'token-3' });
    expect(invokeSpy).toHaveBeenCalledWith('writer_lease_acquire_waiting', {
      holder: 'mount:four',
      resources: ['repo:/repo/api'],
      runId: null,
    });
  });

  it('reports the backend as unavailable rather than inventing a grant', async () => {
    invokeSpy.mockRejectedValue(new Error('no backend'));

    await expect(
      acquireWriterLease({ holder: 'mount:three', resources: ['repo:/repo/api'] }),
    ).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('treats a release failure as already released and an unknown listing as empty', async () => {
    invokeSpy.mockRejectedValue(new Error('no backend'));

    await expect(releaseWriterLease({ token: 'token-1' })).resolves.toBe(false);
    await expect(listUnknownWriterLeases()).resolves.toEqual([]);
  });
});

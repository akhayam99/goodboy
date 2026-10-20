import { describe, expect, it, vi } from 'vitest';
import { readRemoteHead, type RemoteHeadReaders } from './readRemoteHead';

const PATH = '/work/harborline/ledger-core';

const readersOf = (patch: Partial<RemoteHeadReaders> = {}): RemoteHeadReaders => ({
  branchOf: vi.fn(async () => 'ak/ledger-export'),
  remoteHeadOf: vi.fn(async () => 'aaa111'),
  ...patch,
});

describe('readRemoteHead', () => {
  it('reads the checked out branch and its online sha', async () => {
    const readers = readersOf();

    expect(await readRemoteHead({ readers, params: { worktreePath: PATH, branch: null } })).toEqual(
      {
        kind: 'sha',
        branch: 'ak/ledger-export',
        sha: 'aaa111',
      },
    );
    expect(readers.remoteHeadOf).toHaveBeenCalledWith({
      worktreePath: PATH,
      branch: 'ak/ledger-export',
    });
  });

  it('reads the named branch without asking which one is checked out', async () => {
    const readers = readersOf();

    await readRemoteHead({ readers, params: { worktreePath: PATH, branch: 'ak/other' } });

    expect(readers.branchOf).not.toHaveBeenCalled();
    expect(readers.remoteHeadOf).toHaveBeenCalledWith({ worktreePath: PATH, branch: 'ak/other' });
  });

  it('reads absent for a branch that is not online', async () => {
    for (const none of [null, '']) {
      const readers = readersOf({ remoteHeadOf: vi.fn(async () => none) });

      expect(
        await readRemoteHead({ readers, params: { worktreePath: PATH, branch: null } }),
      ).toEqual({ kind: 'absent', branch: 'ak/ledger-export' });
    }
  });

  it('reads unknown for a detached head and for a failed read', async () => {
    const detached = readersOf({ branchOf: vi.fn(async () => null) });
    const failing = readersOf({
      remoteHeadOf: vi.fn(async () => {
        throw new Error('network is down');
      }),
    });

    expect(
      await readRemoteHead({ readers: detached, params: { worktreePath: PATH, branch: null } }),
    ).toEqual({ kind: 'unknown' });
    expect(
      await readRemoteHead({ readers: failing, params: { worktreePath: PATH, branch: null } }),
    ).toEqual({ kind: 'unknown' });
  });
});

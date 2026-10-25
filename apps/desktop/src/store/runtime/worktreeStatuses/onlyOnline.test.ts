import { afterEach, describe, expect, it, vi } from 'vitest';

const invokeCommand = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/lib/invokeCommand', () => ({ invokeCommand }));

import { clearOnlyOnline, loadOnlyOnline, readOnlyOnline } from './onlyOnline';

const BRANCH = 'hl/fix-duplicate-credit';

const targetFor = ({ mountId }: { readonly mountId: string }) => ({
  mountId,
  worktreePath: '/work/payments-api',
  branch: BRANCH,
  workspaceId: null,
  projectId: null,
});

const originWith = ({ subjects }: { readonly subjects: ReadonlyArray<string> }) => ({
  remoteSha: 'b'.repeat(40),
  knownRemoteSha: 'b'.repeat(40),
  commits: [],
  onlyOnline: subjects.map((subject, index) => ({ sha: String(index), subject })),
  fetchError: null,
});

afterEach(() => {
  invokeCommand.mockReset();
});

describe('only online commits', () => {
  it('is unknown until the origin was read', () => {
    expect(readOnlyOnline({ mountId: 'mount-0', branch: BRANCH })).toBeNull();
  });

  it('keeps the subjects of commits that exist only online', async () => {
    invokeCommand.mockResolvedValue(originWith({ subjects: ['Fix rounding', 'Add retry'] }));

    await loadOnlyOnline(targetFor({ mountId: 'mount-1' }));

    expect(readOnlyOnline({ mountId: 'mount-1', branch: BRANCH })).toEqual([
      { sha: '0', subject: 'Fix rounding' },
      { sha: '1', subject: 'Add retry' },
    ]);
  });

  it('reads the origin without refusing merge commits', async () => {
    invokeCommand.mockResolvedValue(originWith({ subjects: [] }));

    await loadOnlyOnline(targetFor({ mountId: 'mount-merge' }));

    expect(invokeCommand).toHaveBeenCalledWith(
      'history_origin_ahead',
      expect.objectContaining({ refuseMerges: false }),
    );
  });

  it('keeps an empty list when the branch only differs by a rebase', async () => {
    invokeCommand.mockResolvedValue(originWith({ subjects: [] }));

    await loadOnlyOnline(targetFor({ mountId: 'mount-2' }));

    expect(readOnlyOnline({ mountId: 'mount-2', branch: BRANCH })).toEqual([]);
  });

  it('keeps the old answer when the read fails', async () => {
    invokeCommand.mockResolvedValueOnce(originWith({ subjects: ['Fix rounding'] }));
    await loadOnlyOnline(targetFor({ mountId: 'mount-3' }));
    invokeCommand.mockRejectedValueOnce(new Error('offline'));

    await expect(loadOnlyOnline(targetFor({ mountId: 'mount-3' }))).rejects.toThrow('offline');

    expect(readOnlyOnline({ mountId: 'mount-3', branch: BRANCH })).toEqual([
      { sha: '0', subject: 'Fix rounding' },
    ]);
  });

  it('drops a late answer for an older request', async () => {
    let releaseFirst: (value: unknown) => void = () => undefined;
    invokeCommand.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseFirst = resolve;
      }),
    );
    const first = loadOnlyOnline(targetFor({ mountId: 'mount-4' }));
    invokeCommand.mockResolvedValueOnce(originWith({ subjects: ['Newest'] }));
    await loadOnlyOnline(targetFor({ mountId: 'mount-4' }));

    releaseFirst(originWith({ subjects: ['Stale'] }));
    await first;

    expect(readOnlyOnline({ mountId: 'mount-4', branch: BRANCH })).toEqual([
      { sha: '0', subject: 'Newest' },
    ]);
  });

  it('reads nothing for another branch of the same mount until it loaded', async () => {
    invokeCommand.mockResolvedValueOnce(originWith({ subjects: ['Fix rounding'] }));
    await loadOnlyOnline(targetFor({ mountId: 'mount-5' }));

    expect(readOnlyOnline({ mountId: 'mount-5', branch: 'hl/other-branch' })).toBeNull();

    invokeCommand.mockResolvedValueOnce(originWith({ subjects: [] }));
    await loadOnlyOnline({ ...targetFor({ mountId: 'mount-5' }), branch: 'hl/other-branch' });

    expect(readOnlyOnline({ mountId: 'mount-5', branch: 'hl/other-branch' })).toEqual([]);
    expect(readOnlyOnline({ mountId: 'mount-5', branch: BRANCH })).toBeNull();
  });

  it('forgets the list when cleared and drops an answer still in flight', async () => {
    let releaseLoad: (value: unknown) => void = () => undefined;
    invokeCommand.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseLoad = resolve;
      }),
    );
    const pending = loadOnlyOnline(targetFor({ mountId: 'mount-6' }));

    clearOnlyOnline({ mountId: 'mount-6' });
    releaseLoad(originWith({ subjects: ['Stale'] }));
    await pending;

    expect(readOnlyOnline({ mountId: 'mount-6', branch: BRANCH })).toBeNull();
  });
});

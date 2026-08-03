// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchReleasesMock } = vi.hoisted(() => ({ fetchReleasesMock: vi.fn() }));

vi.mock('../../../features/changelog/changelog', () => ({ fetchReleases: fetchReleasesMock }));

import { createChangelogSlice } from './index';
import { initialChangelogState, type ChangelogState } from './state';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

const release = {
  version: 'v0.1.55',
  publishedAt: '2026-07-01T10:00:00Z',
  body: '## the round\n\n- one thing',
  htmlUrl: 'https://github.com/akhayam99/goodboy/releases/tag/v0.1.55',
};

const harness = () => {
  let state: ChangelogState = { ...initialChangelogState };
  const set = (p: Partial<ChangelogState> | ((s: ChangelogState) => Partial<ChangelogState>)) => {
    state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
  };
  const slice = createChangelogSlice(set as never, (() => ({ ...state, ...slice })) as never);
  return { slice, getState: () => state };
};

describe('changelog slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('caches the payload and does not refetch once it is ready', async () => {
    fetchReleasesMock.mockResolvedValue([release]);
    const { slice, getState } = harness();

    await slice.loadChangelog();
    await slice.loadChangelog();

    expect(fetchReleasesMock).toHaveBeenCalledOnce();
    expect(getState().changelogStatus).toBe('ready');
    expect(getState().changelogReleases).toEqual([release]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.changelogCache) ?? '{}').releases).toEqual([
      release,
    ]);
  });

  it('falls back to the persisted cache when the fetch fails', async () => {
    localStorage.setItem(
      STORAGE_KEYS.changelogCache,
      JSON.stringify({ fetchedAt: '2026-06-30T09:00:00Z', releases: [release] }),
    );
    fetchReleasesMock.mockRejectedValue(new Error('network down'));
    const { slice, getState } = harness();

    await slice.loadChangelog();

    expect(getState().changelogStatus).toBe('error');
    expect(getState().changelogError).toBe('network down');
    expect(getState().changelogReleases).toEqual([release]);
    expect(getState().changelogFetchedAt).toBe('2026-06-30T09:00:00Z');
  });

  it('reports the failure with nothing to show when there is no cache', async () => {
    fetchReleasesMock.mockRejectedValue(new Error('network down'));
    const { slice, getState } = harness();

    await slice.loadChangelog();

    expect(getState().changelogStatus).toBe('error');
    expect(getState().changelogReleases).toEqual([]);
    expect(getState().changelogFetchedAt).toBeNull();
  });

  it('refetches on an explicit reload after a failure', async () => {
    fetchReleasesMock.mockRejectedValueOnce(new Error('network down'));
    fetchReleasesMock.mockResolvedValueOnce([release]);
    const { slice, getState } = harness();

    await slice.loadChangelog();
    await slice.reloadChangelog();

    expect(fetchReleasesMock).toHaveBeenCalledTimes(2);
    expect(getState().changelogStatus).toBe('ready');
    expect(getState().changelogError).toBeNull();
  });
});

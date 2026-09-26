// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchReleasesMock, getSettingMock, setSettingMock } = vi.hoisted(() => ({
  fetchReleasesMock: vi.fn(),
  getSettingMock: vi.fn(async () => null as string | null),
  setSettingMock: vi.fn(async () => undefined),
}));

vi.mock('../../../features/changelog/changelog', () => ({ fetchReleases: fetchReleasesMock }));

vi.mock('@goodboy/db', () => ({ getSetting: getSettingMock, setSetting: setSettingMock }));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: { execute: vi.fn(), select: vi.fn() } }));

import { createChangelogSlice } from './index';
import { initialChangelogState, SETTING_CHANGELOG_SEEN, type ChangelogState } from './state';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

const dateRelease = {
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

  it('has every release from CHANGELOG.md available synchronously, with no fetch', () => {
    const { getState } = harness();

    expect(getState().changelogReleases.length).toBe(89);
    expect(fetchReleasesMock).not.toHaveBeenCalled();
  });

  it('caches the release dates and does not refetch once ready', async () => {
    fetchReleasesMock.mockResolvedValue([dateRelease]);
    const { slice, getState } = harness();

    await slice.loadChangelogDates();
    await slice.loadChangelogDates();

    expect(fetchReleasesMock).toHaveBeenCalledOnce();
    expect(getState().changelogDatesStatus).toBe('ready');
    expect(getState().changelogDates['0.1.55']).toBe('2026-07-01T10:00:00Z');
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.changelogCache) ?? '{}');
    expect(cached.dates['0.1.55']).toBe('2026-07-01T10:00:00Z');
  });

  it('falls back to the persisted date cache when the fetch fails', async () => {
    localStorage.setItem(
      STORAGE_KEYS.changelogCache,
      JSON.stringify({
        fetchedAt: '2026-06-30T09:00:00Z',
        dates: { '0.1.55': '2026-06-30T09:00:00Z' },
      }),
    );
    fetchReleasesMock.mockRejectedValue(new Error('network down'));
    const { slice, getState } = harness();

    await slice.loadChangelogDates();

    expect(getState().changelogDatesStatus).toBe('error');
    expect(getState().changelogDates['0.1.55']).toBe('2026-06-30T09:00:00Z');
    expect(getState().changelogDatesFetchedAt).toBe('2026-06-30T09:00:00Z');
  });

  it('shows no dates, and no error surface, when the fetch fails with no cache', async () => {
    fetchReleasesMock.mockRejectedValue(new Error('network down'));
    const { slice, getState } = harness();

    await slice.loadChangelogDates();

    expect(getState().changelogDatesStatus).toBe('error');
    expect(getState().changelogDates).toEqual({});
    expect(getState().changelogDatesFetchedAt).toBeNull();
  });

  it('remembers across launches which version the user has already read', async () => {
    getSettingMock.mockResolvedValue('0.1.66');
    const { slice, getState } = harness();

    await slice.hydrateChangelogSeen();

    expect(getSettingMock).toHaveBeenCalledWith(expect.anything(), SETTING_CHANGELOG_SEEN);
    expect(getState().changelogSeenVersion).toBe('0.1.66');
  });

  it('starts with nothing read when the setting has never been written', async () => {
    getSettingMock.mockResolvedValue(null);
    const { slice, getState } = harness();

    await slice.hydrateChangelogSeen();

    expect(getState().changelogSeenVersion).toBeNull();
  });

  it('persists the version marked as read and writes it only once', async () => {
    const { slice, getState } = harness();

    await slice.markChangelogSeen({ version: '0.1.67' });
    await slice.markChangelogSeen({ version: '0.1.67' });

    expect(getState().changelogSeenVersion).toBe('0.1.67');
    expect(setSettingMock).toHaveBeenCalledTimes(1);
    expect(setSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_CHANGELOG_SEEN,
      '0.1.67',
    );
  });

  it('refetches on an explicit reload after a failure', async () => {
    fetchReleasesMock.mockRejectedValueOnce(new Error('network down'));
    fetchReleasesMock.mockResolvedValueOnce([dateRelease]);
    const { slice, getState } = harness();

    await slice.loadChangelogDates();
    await slice.reloadChangelogDates();

    expect(fetchReleasesMock).toHaveBeenCalledTimes(2);
    expect(getState().changelogDatesStatus).toBe('ready');
  });

  it('marks the seen version as hydrated even when nothing is stored', async () => {
    getSettingMock.mockResolvedValueOnce(null);
    const { slice, getState } = harness();

    await slice.hydrateChangelogSeen();

    expect(getState().changelogSeenHydrated).toBe(true);
    expect(getState().changelogSeenVersion).toBeNull();
  });

  it('holds the release to focus until it is cleared', () => {
    const { slice, getState } = harness();

    slice.focusChangelogRelease({ version: '0.3.14' });
    expect(getState().changelogFocusVersion).toBe('0.3.14');

    slice.focusChangelogRelease({ version: null });
    expect(getState().changelogFocusVersion).toBeNull();
  });
});

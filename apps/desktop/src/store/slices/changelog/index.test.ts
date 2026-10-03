// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchReleasesMock,
  getSettingMock,
  setSettingMock,
  fetchReleaseChangelogMock,
  getVersionMock,
} = vi.hoisted(() => ({
  fetchReleasesMock: vi.fn(),
  fetchReleaseChangelogMock: vi.fn(async (_params: { version: string }) => ''),
  getVersionMock: vi.fn(async () => '0.12.2'),
  getSettingMock: vi.fn(async () => null as string | null),
  setSettingMock: vi.fn(async () => undefined),
}));

vi.mock('../../../features/changelog/changelog', () => ({ fetchReleases: fetchReleasesMock }));

vi.mock('../../../features/changelog/fetchReleaseChangelog', () => ({
  fetchReleaseChangelog: fetchReleaseChangelogMock,
}));

vi.mock('@tauri-apps/api/app', () => ({ getVersion: getVersionMock }));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
  }),
);

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
  const slice = createChangelogSlice({
    set: set as never,
    get: (() => ({ ...state, ...slice })) as never,
  });
  return { slice, getState: () => state };
};

describe('changelog slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('has every release from CHANGELOG.md available synchronously, with no fetch', () => {
    const { getState } = harness();

    expect(getState().changelogReleases.length).toBe(112);
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

  const fetchedChangelog = [
    '## Goodboy v0.13.0',
    '',
    'Ask about the Harborline workspace in a chat.',
    '',
    '### Fixed',
    '',
    '- A chat reopens where you left it. <!-- gb area=sessions -->',
    '',
    '## Goodboy v0.12.3',
    '',
    'Link work from one search.',
    '',
    '### Fixed',
    '',
    '- Search covers every tracker. <!-- gb area=sessions -->',
    '',
    '## Goodboy v0.12.2',
    '',
    'Faster board.',
    '',
    '### Fixed',
    '',
    '- The board scrolls again. <!-- gb area=app -->',
  ].join('\n');

  it('loads the releases between the installed version and the update from the update tag', async () => {
    fetchReleaseChangelogMock.mockResolvedValueOnce(fetchedChangelog);
    const { slice, getState } = harness();

    await slice.loadChangelogUpcoming({ target: '0.13.0' });

    expect(fetchReleaseChangelogMock).toHaveBeenCalledWith({ version: '0.13.0' });
    expect(getState().changelogUpcoming?.target).toBe('0.13.0');
    expect(getState().changelogUpcoming?.releases.map((release) => release.version)).toEqual([
      '0.13.0',
      '0.12.3',
    ]);
  });

  it('keeps the loaded releases for the session and fetches once per target', async () => {
    fetchReleaseChangelogMock.mockResolvedValue(fetchedChangelog);
    const { slice } = harness();

    await Promise.all([
      slice.loadChangelogUpcoming({ target: '0.13.0' }),
      slice.loadChangelogUpcoming({ target: 'v0.13.0' }),
    ]);
    await slice.loadChangelogUpcoming({ target: '0.13.0' });

    expect(fetchReleaseChangelogMock).toHaveBeenCalledOnce();
  });

  it('leaves nothing loaded when the fetch fails, so a later open tries again', async () => {
    fetchReleaseChangelogMock.mockRejectedValueOnce(new Error('offline'));
    fetchReleaseChangelogMock.mockResolvedValueOnce(fetchedChangelog);
    const { slice, getState } = harness();

    await slice.loadChangelogUpcoming({ target: '0.13.0' });
    expect(getState().changelogUpcoming).toBeNull();

    await slice.loadChangelogUpcoming({ target: '0.13.0' });
    expect(getState().changelogUpcoming?.releases).toHaveLength(2);
  });
});

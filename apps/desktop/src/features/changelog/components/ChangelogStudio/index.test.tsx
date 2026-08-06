// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReleaseNote } from '../../changelog';
import type { ChangelogState } from '../../../../store/slices/changelog/state';

const mocks = vi.hoisted(() => ({
  state: null as unknown as ChangelogState,
  loadChangelog: vi.fn(async () => undefined),
  reloadChangelog: vi.fn(async () => undefined),
  markChangelogSeen: vi.fn(async () => undefined),
  installedVersion: null as string | null,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      ...mocks.state,
      loadChangelog: mocks.loadChangelog,
      reloadChangelog: mocks.reloadChangelog,
      markChangelogSeen: mocks.markChangelogSeen,
    }),
}));

vi.mock('../../hooks/useInstalledVersion', () => ({
  useInstalledVersion: () => mocks.installedVersion,
}));

import { ChangelogStudio } from './index';

const buildRelease = (version: string, publishedAt: string): ReleaseNote => ({
  version,
  publishedAt,
  body: '## the round\n\n- shipped something',
  htmlUrl: `https://github.com/akhayam99/goodboy/releases/tag/${version}`,
});

const renderStudio = () => render(<ChangelogStudio workspaceName="goodboy" onClose={vi.fn()} />);

beforeEach(() => {
  mocks.state = {
    changelogReleases: [],
    changelogStatus: 'idle',
    changelogError: null,
    changelogFetchedAt: null,
    changelogSeenVersion: null,
  };
  mocks.installedVersion = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChangelogStudio', () => {
  it('marks the installed version in the rail and leaves the newer one unmarked', () => {
    mocks.state = {
      changelogReleases: [
        buildRelease('v0.1.56', '2026-07-10T10:00:00Z'),
        buildRelease('v0.1.55', '2026-07-01T10:00:00Z'),
      ],
      changelogStatus: 'ready',
      changelogError: null,
      changelogFetchedAt: '2026-07-11T10:00:00Z',
      changelogSeenVersion: null,
    };
    mocks.installedVersion = '0.1.55';

    renderStudio();

    const rail = screen.getByRole('navigation', { name: 'Releases' });
    const rows = Array.from(rail.querySelectorAll('button'));
    const installedRow = rows.find((row) => row.textContent?.includes('v0.1.55'));
    const newerRow = rows.find((row) => row.textContent?.includes('v0.1.56'));
    expect(installedRow?.textContent).toContain('installed');
    expect(newerRow?.textContent).not.toContain('installed');
  });

  it('renders the newest release body in full, with no redundant external link', () => {
    mocks.state = {
      changelogReleases: [buildRelease('v0.1.56', '2026-07-10T10:00:00Z')],
      changelogStatus: 'ready',
      changelogError: null,
      changelogFetchedAt: '2026-07-11T10:00:00Z',
      changelogSeenVersion: null,
    };

    renderStudio();

    expect(screen.getByRole('heading', { name: 'v0.1.56' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Open on GitHub/ })).toBeNull();
  });

  it('offers a retry and no release list when the fetch failed with no cache', () => {
    mocks.state = {
      changelogReleases: [],
      changelogStatus: 'error',
      changelogError: 'network down',
      changelogFetchedAt: null,
      changelogSeenVersion: null,
    };

    renderStudio();

    expect(screen.getByText("Couldn't load releases")).toBeDefined();
    expect(screen.getByText('Check your connection and retry')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Releases' })?.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.reloadChangelog).toHaveBeenCalledOnce();
  });

  it('keeps the cached releases visible with a staleness line when the refresh failed', () => {
    mocks.state = {
      changelogReleases: [buildRelease('v0.1.55', '2026-07-01T10:00:00Z')],
      changelogStatus: 'error',
      changelogError: 'network down',
      changelogFetchedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      changelogSeenVersion: null,
    };

    renderStudio();

    expect(screen.getByRole('heading', { name: 'v0.1.55' })).toBeDefined();
    expect(screen.getByText(/last updated 2h ago/)).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('network down');
  });

  it('marks the running version as read once the studio is open', () => {
    mocks.state = {
      changelogReleases: [buildRelease('v0.1.55', '2026-07-01T10:00:00Z')],
      changelogStatus: 'ready',
      changelogError: null,
      changelogFetchedAt: '2026-07-11T10:00:00Z',
      changelogSeenVersion: null,
    };
    mocks.installedVersion = '0.1.55';

    renderStudio();

    expect(mocks.markChangelogSeen).toHaveBeenCalledWith({ version: '0.1.55' });
  });

  it('marks nothing while the running version is still unknown', () => {
    mocks.installedVersion = null;

    renderStudio();

    expect(mocks.markChangelogSeen).not.toHaveBeenCalled();
  });

  it('marks nothing when the fetch failed and there is no cache to read', () => {
    mocks.state = {
      changelogReleases: [],
      changelogStatus: 'error',
      changelogError: 'network down',
      changelogFetchedAt: null,
      changelogSeenVersion: null,
    };
    mocks.installedVersion = '0.1.55';

    renderStudio();

    expect(mocks.markChangelogSeen).not.toHaveBeenCalled();
  });

  it('marks nothing while the fetch is still in flight', () => {
    mocks.state = {
      changelogReleases: [],
      changelogStatus: 'loading',
      changelogError: null,
      changelogFetchedAt: null,
      changelogSeenVersion: null,
    };
    mocks.installedVersion = '0.1.55';

    renderStudio();

    expect(mocks.markChangelogSeen).not.toHaveBeenCalled();
  });

  it('marks nothing when the installed version is not yet in the fetched releases', () => {
    mocks.state = {
      changelogReleases: [buildRelease('v0.1.56', '2026-07-10T10:00:00Z')],
      changelogStatus: 'ready',
      changelogError: null,
      changelogFetchedAt: '2026-07-11T10:00:00Z',
      changelogSeenVersion: null,
    };
    mocks.installedVersion = '0.1.55';

    renderStudio();

    expect(mocks.markChangelogSeen).not.toHaveBeenCalled();
  });

  it('says nothing shipped yet when the list comes back empty', () => {
    mocks.state = {
      changelogReleases: [],
      changelogStatus: 'ready',
      changelogError: null,
      changelogFetchedAt: '2026-07-11T10:00:00Z',
      changelogSeenVersion: null,
    };

    renderStudio();

    expect(screen.getByText('No published releases yet')).toBeDefined();
  });
});

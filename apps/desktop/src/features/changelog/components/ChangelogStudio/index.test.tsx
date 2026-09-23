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
  focusChangelogRelease: vi.fn(),
  installUpdate: vi.fn(async () => undefined),
  updater: { status: 'idle', version: null as string | null },
  installedVersion: null as string | null,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      ...mocks.state,
      loadChangelog: mocks.loadChangelog,
      reloadChangelog: mocks.reloadChangelog,
      markChangelogSeen: mocks.markChangelogSeen,
      focusChangelogRelease: mocks.focusChangelogRelease,
      installUpdate: mocks.installUpdate,
      updaterStatus: mocks.updater.status,
      updateVersion: mocks.updater.version,
      updateFailure: null,
      agentTurnState: {},
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
    changelogSeenHydrated: true,
    changelogFocusVersion: null,
  };
  mocks.installedVersion = null;
  mocks.updater = { status: 'idle', version: null };
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
    };
    mocks.installedVersion = '0.1.55';

    renderStudio();

    const rail = screen.getByRole('navigation', { name: 'Releases' });
    const rows = Array.from(rail.querySelectorAll('button'));
    const installedRow = rows.find((row) => row.textContent?.includes('v0.1.55'));
    const newerRow = rows.find((row) => row.textContent?.includes('v0.1.56'));
    expect(installedRow?.textContent).toContain('installed');
    expect(newerRow?.textContent).not.toContain('installed');
    expect(newerRow?.textContent).toContain('available');
    expect(installedRow?.textContent).not.toContain('available');
  });

  const threeReleases = () => ({
    changelogReleases: [
      buildRelease('v0.3.14', '2026-09-20T10:00:00Z'),
      buildRelease('v0.3.13', '2026-09-10T10:00:00Z'),
      buildRelease('v0.3.12', '2026-09-01T10:00:00Z'),
    ],
    changelogStatus: 'ready' as const,
    changelogError: null,
    changelogFetchedAt: '2026-09-21T10:00:00Z',
    changelogSeenVersion: null,
    changelogSeenHydrated: true,
    changelogFocusVersion: null,
  });

  it('opens on the focused release and clears the focus', () => {
    mocks.state = { ...threeReleases(), changelogFocusVersion: '0.3.12' };
    mocks.installedVersion = '0.3.13';

    renderStudio();

    expect(screen.getByRole('heading', { name: 'v0.3.12' })).toBeDefined();
    expect(mocks.focusChangelogRelease).toHaveBeenCalledWith({ version: null });
  });

  it('opens on the installed release when nothing is focused', () => {
    mocks.state = threeReleases();
    mocks.installedVersion = '0.3.13';

    renderStudio();

    expect(screen.getByRole('heading', { name: 'v0.3.13' })).toBeDefined();
  });

  it('falls back to the newest release when the installed one is not listed', () => {
    mocks.state = threeReleases();
    mocks.installedVersion = '0.2.0';

    renderStudio();

    expect(screen.getByRole('heading', { name: 'v0.3.14' })).toBeDefined();
  });

  it('offers the download on the release the updater found', () => {
    mocks.state = { ...threeReleases(), changelogFocusVersion: '0.3.14' };
    mocks.installedVersion = '0.3.13';
    mocks.updater = { status: 'available', version: '0.3.14' };

    renderStudio();

    expect(screen.getByRole('button', { name: 'Download and restart' })).toBeDefined();
  });

  it('renders the newest release body in full, with no redundant external link', () => {
    mocks.state = {
      changelogReleases: [buildRelease('v0.1.56', '2026-07-10T10:00:00Z')],
      changelogStatus: 'ready',
      changelogError: null,
      changelogFetchedAt: '2026-07-11T10:00:00Z',
      changelogSeenVersion: null,
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
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
      changelogSeenHydrated: true,
      changelogFocusVersion: null,
    };

    renderStudio();

    expect(screen.getByText('No published releases yet')).toBeDefined();
  });
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ChangelogState } from '../../../../store/slices/changelog/state';
import type { ReleaseEntry } from '../../parseChangelog';

const mocks = vi.hoisted(() => ({
  state: null as unknown as ChangelogState,
  loadChangelogDates: vi.fn(async () => undefined),
  reloadChangelogDates: vi.fn(async () => undefined),
  markChangelogSeen: vi.fn(async () => undefined),
  focusChangelogRelease: vi.fn(),
  loadChangelogUpcoming: vi.fn(async () => undefined),
  updateNotes: null as ReleaseEntry | null,
  applyUpdate: vi.fn(async () => undefined),
  updater: { status: 'idle', version: null as string | null },
  installedVersion: null as string | null,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      ...mocks.state,
      loadChangelogDates: mocks.loadChangelogDates,
      reloadChangelogDates: mocks.reloadChangelogDates,
      markChangelogSeen: mocks.markChangelogSeen,
      focusChangelogRelease: mocks.focusChangelogRelease,
      loadChangelogUpcoming: mocks.loadChangelogUpcoming,
      updateNotes: mocks.updateNotes,
      applyUpdate: mocks.applyUpdate,
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

const buildRelease = (version: string, markdown: string): ReleaseEntry => ({
  version,
  shape: 'markdown',
  lead: null,
  oneWayFrom: null,
  sections: { new: [], improved: [], fixed: [] },
  markdown,
  publishedAt: null,
});

const renderStudio = () => render(<ChangelogStudio onClose={vi.fn()} onOpenScreen={vi.fn()} />);

const baseState = (releases: ReadonlyArray<ReleaseEntry>): ChangelogState => ({
  changelogReleases: releases,
  changelogDates: {},
  changelogDatesStatus: 'idle',
  changelogDatesFetchedAt: null,
  changelogSeenVersion: null,
  changelogSeenHydrated: true,
  changelogFocusVersion: null,
  changelogUpcoming: null,
});

beforeEach(() => {
  mocks.state = baseState([]);
  mocks.installedVersion = null;
  mocks.updater = { status: 'idle', version: null };
  mocks.updateNotes = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChangelogStudio', () => {
  it('marks the installed version in the rail and leaves the newer one unmarked', () => {
    mocks.state = baseState([
      buildRelease('0.5.6', 'shipped something newer'),
      buildRelease('0.5.5', 'shipped something'),
    ]);
    mocks.installedVersion = '0.5.5';

    renderStudio();

    const rail = screen.getByRole('navigation', { name: 'Releases' });
    const rows = Array.from(rail.querySelectorAll('button'));
    const installedRow = rows.find((row) => row.textContent?.includes('0.5.5'));
    const newerRow = rows.find((row) => row.textContent?.includes('0.5.6'));
    expect(installedRow?.textContent).toContain('installed');
    expect(newerRow?.textContent).not.toContain('installed');
    expect(newerRow?.textContent).toContain('in the update');
    expect(installedRow?.textContent).not.toContain('in the update');
  });

  const threeReleases = () =>
    baseState([
      buildRelease('0.3.14', 'shipped the third thing'),
      buildRelease('0.3.13', 'shipped the second thing'),
      buildRelease('0.3.12', 'shipped the first thing'),
    ]);

  it('opens on the focused release and clears the focus', () => {
    mocks.state = { ...threeReleases(), changelogFocusVersion: '0.3.12' };
    mocks.installedVersion = '0.3.13';

    renderStudio();

    expect(screen.getByRole('heading', { name: 'Goodboy 0.3.12' })).toBeDefined();
    expect(mocks.focusChangelogRelease).toHaveBeenCalledWith({ version: null });
  });

  it('opens on the installed release when nothing is focused', () => {
    mocks.state = threeReleases();
    mocks.installedVersion = '0.3.13';

    renderStudio();

    expect(screen.getByRole('heading', { name: 'Goodboy 0.3.13' })).toBeDefined();
  });

  it('falls back to the newest release when the installed one is not listed', () => {
    mocks.state = threeReleases();
    mocks.installedVersion = '0.2.0';

    renderStudio();

    expect(screen.getByRole('heading', { name: 'Goodboy 0.3.14' })).toBeDefined();
  });

  it('offers the download on the release the updater found', () => {
    mocks.state = { ...threeReleases(), changelogFocusVersion: '0.3.14' };
    mocks.installedVersion = '0.3.13';
    mocks.updater = { status: 'available', version: '0.3.14' };

    renderStudio();

    expect(screen.getByRole('button', { name: 'Download and restart' })).toBeDefined();
  });

  it('renders the newest release body in full', () => {
    mocks.state = baseState([buildRelease('0.1.56', 'shipped something notable')]);

    renderStudio();

    expect(screen.getByRole('heading', { name: 'Goodboy 0.1.56' })).toBeDefined();
    expect(screen.getByText('shipped something notable')).toBeDefined();
  });

  it('marks the running version as read once the studio is open', () => {
    mocks.state = baseState([buildRelease('0.1.55', 'shipped something')]);
    mocks.installedVersion = '0.1.55';

    renderStudio();

    expect(mocks.markChangelogSeen).toHaveBeenCalledWith({ version: '0.1.55' });
  });

  it('marks nothing while the running version is still unknown', () => {
    mocks.installedVersion = null;

    renderStudio();

    expect(mocks.markChangelogSeen).not.toHaveBeenCalled();
  });

  it('says nothing shipped yet when the list comes back empty', () => {
    mocks.state = baseState([]);

    renderStudio();

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('filters the rail with a search query', () => {
    mocks.state = threeReleases();
    mocks.installedVersion = '0.3.14';

    renderStudio();

    const search = screen.getByRole('textbox', { name: 'Search releases' });
    fireEvent.change(search, { target: { value: 'xylophonemarmot' } });

    expect(screen.getByText(/No release mentions/)).toBeDefined();
  });

  const railVersions = (): ReadonlyArray<string> => {
    const rail = screen.getByRole('navigation', { name: 'Releases' });
    return Array.from(rail.querySelectorAll('button'))
      .map((row) => row.textContent ?? '')
      .filter((text) => /^\d/.test(text));
  };

  it('lists the releases of the update above the installed ones and opens on the target', () => {
    mocks.state = {
      ...baseState([
        buildRelease('0.12.2', 'shipped the installed thing'),
        buildRelease('0.12.1', 'shipped an older thing'),
      ]),
      changelogFocusVersion: '0.13.0',
      changelogUpcoming: {
        target: '0.13.0',
        releases: [
          buildRelease('0.13.0', 'shipped chats for Harborline'),
          buildRelease('0.12.3', 'shipped link work for Northwind'),
        ],
      },
    };
    mocks.installedVersion = '0.12.2';
    mocks.updater = { status: 'available', version: '0.13.0' };

    renderStudio();

    expect(mocks.loadChangelogUpcoming).toHaveBeenCalledWith({ target: '0.13.0' });
    expect(screen.getByRole('heading', { name: 'Goodboy 0.13.0' })).toBeDefined();
    expect(screen.getByText('In the update')).toBeDefined();
    const rows = railVersions();
    expect(rows.map((text) => text.slice(0, 6))).toEqual(['0.13.0', '0.12.3', '0.12.2', '0.12.1']);
    expect(rows[0]).toContain('in the update');
    expect(rows[1]).toContain('in the update');
    expect(rows[2]).toContain('installed');
  });

  it('falls back to the notes of the update while its changelog is not loaded', () => {
    mocks.state = {
      ...baseState([buildRelease('0.12.2', 'shipped the installed thing')]),
      changelogFocusVersion: '0.13.0',
    };
    mocks.installedVersion = '0.12.2';
    mocks.updater = { status: 'ready', version: '0.13.0' };
    mocks.updateNotes = buildRelease('0.13.0', 'shipped chats for Acme');

    renderStudio();

    expect(screen.getByRole('heading', { name: 'Goodboy 0.13.0' })).toBeDefined();
    expect(railVersions()[0]).toContain('in the update');
  });

  it('lands on the update instead of the catch-up when opened from the update', () => {
    mocks.state = {
      ...baseState([
        buildRelease('0.12.2', 'shipped the installed thing'),
        buildRelease('0.12.1', 'shipped a skipped thing'),
        buildRelease('0.12.0', 'shipped the seen thing'),
      ]),
      changelogSeenVersion: '0.12.0',
      changelogFocusVersion: '0.13.0',
    };
    mocks.installedVersion = '0.12.2';
    mocks.updater = { status: 'available', version: '0.13.0' };
    mocks.updateNotes = buildRelease('0.13.0', 'shipped chats for Cascadia');

    renderStudio();

    expect(screen.getByRole('heading', { name: 'Goodboy 0.13.0' })).toBeDefined();
  });
});

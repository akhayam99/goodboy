// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import {
  harborline,
  ledgerCore,
  mergedGithub,
  paymentsApi,
  renderBar,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const webhook = sessionOf({
  goal: 'Fix webhook retries',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
  createdAt: '2026-09-03T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
});
const ledgerExport = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-10-06T09:00:00.000Z',
});
const copy = sessionOf({
  goal: 'Cascadia onboarding copy',
  lastOpenedAt: '2026-10-04T09:00:00.000Z',
  createdAt: '2026-09-02T09:00:00.000Z',
  updatedAt: '2026-10-04T09:00:00.000Z',
});
const old = sessionOf({ goal: 'Legacy hook cleanup' });
const older = sessionOf({ goal: 'Spike: batch settle' });
const all = [webhook, ledgerExport, copy];

const mount = () => {
  seedColumn({
    store: useAppStore,
    sessions: all,
    archived: [old, older],
    mounts: [
      [webhook, paymentsApi],
      [ledgerExport, ledgerCore],
      [copy, paymentsApi],
    ],
  });
  return renderBar();
};

const titlesOnScreen = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('data-select-id'))
    .map((button) => button.lastElementChild?.textContent ?? '');

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Options for sessions' }));
  return screen.getByRole('menu', { name: 'Options for sessions' });
};

const storedPrefs = (workspaceId: WorkspaceId): unknown =>
  JSON.parse(localStorage.getItem(`${STORAGE_PREFIXES.sessionView}${workspaceId}`) ?? 'null');

describe('the Sessions options menu', () => {
  it('lists sort, group, filter by project and show archived', () => {
    mount();
    const menu = openMenu();
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual([
      'Needs you first',
      'Alphabetical',
      'Last activity',
      'Created',
      'None',
      'PR state',
      'Stage',
      'Project',
    ]);
    expect(within(menu).getByRole('group', { name: 'Filter by project' })).toBeDefined();
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Show archived (2)' })).toBeDefined();
  });

  it('starts on Needs you first and no grouping', () => {
    mount();
    const menu = openMenu();
    expect(
      within(menu)
        .getByRole('menuitemradio', { name: 'Needs you first' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'None' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('closes on Escape and returns focus to its button', () => {
    mount();
    const trigger = screen.getByRole('button', { name: 'Options for sessions' });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Options for sessions' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the page behind it is clicked', () => {
    mount();
    openMenu();
    const backdrop = document.body.querySelector('[data-dropdown-portal] > :first-child');
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole('menu', { name: 'Options for sessions' })).toBeNull();
  });
});

describe('sort', () => {
  it.each([
    ['Alphabetical', ['Cascadia onboarding copy', 'Fix webhook retries', 'Ledger export speedup']],
    ['Last activity', ['Ledger export speedup', 'Cascadia onboarding copy', 'Fix webhook retries']],
    ['Created', ['Fix webhook retries', 'Cascadia onboarding copy', 'Ledger export speedup']],
    [
      'Needs you first',
      ['Fix webhook retries', 'Ledger export speedup', 'Cascadia onboarding copy'],
    ],
  ])('orders the list by %s', (label, expected) => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: label }));
    expect(titlesOnScreen()).toEqual(expected);
  });

  it('remembers the choice for this workspace only', () => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Alphabetical' }));
    expect(storedPrefs(harborline.id)).toMatchObject({ v: 2, sort: 'goal' });
    expect(storedPrefs('workspace-cascadia' as WorkspaceId)).toBeNull();
  });

  it('comes back after the window reloads', () => {
    const first = mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Alphabetical' }));
    first.unmount();
    useAppStore.setState({ sessionViewPrefs: {} });
    renderBar();
    expect(titlesOnScreen()[0]).toBe('Cascadia onboarding copy');
  });
});

const closeMenu = () => {
  fireEvent.keyDown(window, { key: 'Escape' });
};

const groupHeaders = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('button')
    .filter(
      (button) =>
        button.hasAttribute('aria-expanded') && button.getAttribute('aria-haspopup') === null,
    )
    .map((button) => button.textContent ?? '');

describe('group', () => {
  it('groups by project with the project name and a count', () => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Project' }));
    closeMenu();
    expect(groupHeaders()).toEqual(['ledger-core1', 'payments-api2']);
  });

  it('groups by stage and keeps the sessions in each group', () => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Stage' }));
    closeMenu();
    expect(groupHeaders()).toHaveLength(1);
    expect(titlesOnScreen()).toHaveLength(3);
  });

  it('folds a group from its header', () => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Project' }));
    closeMenu();
    fireEvent.click(screen.getByRole('button', { name: /^payments-api/ }));
    expect(titlesOnScreen()).toEqual(['Ledger export speedup']);
  });

  it('keeps finished work collapsed under Stage until its labeled count is opened', () => {
    seedColumn({ store: useAppStore, sessions: [webhook, ledgerExport] });
    useAppStore.setState({ sessionGithub: { [ledgerExport.id]: mergedGithub() } });
    renderBar();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Stage' }));
    closeMenu();
    const done = screen.getByRole('button', { name: 'done' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Ledger export speedup' })).toBeNull();
    fireEvent.click(done);
    expect(done.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Ledger export speedup' })).toBeDefined();
  });

  it('returns to one flat list on None', () => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Project' }));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: 'None' }));
    closeMenu();
    expect(groupHeaders()).toHaveLength(0);
    expect(titlesOnScreen()).toHaveLength(3);
  });
});

describe('filter by project', () => {
  it('lists the projects of the open sessions with their counts', () => {
    mount();
    const group = within(openMenu()).getByRole('group', { name: 'Filter by project' });
    expect(
      within(group)
        .getAllByRole('menuitemcheckbox')
        .map((item) => item.textContent),
    ).toEqual(['ledger-core1', 'payments-api2']);
  });

  it('keeps only the sessions of the checked project and restores them when unchecked', () => {
    mount();
    const group = within(openMenu()).getByRole('group', { name: 'Filter by project' });
    fireEvent.click(within(group).getByRole('menuitemcheckbox', { name: /^payments-api/ }));
    expect(titlesOnScreen()).toEqual(['Fix webhook retries', 'Cascadia onboarding copy']);
    fireEvent.click(within(group).getByRole('menuitemcheckbox', { name: /^payments-api/ }));
    expect(titlesOnScreen()).toHaveLength(3);
  });

  it('shares its choice with the board filter', () => {
    mount();
    const group = within(openMenu()).getByRole('group', { name: 'Filter by project' });
    fireEvent.click(within(group).getByRole('menuitemcheckbox', { name: /^ledger-core/ }));
    expect(useAppStore.getState().selectedProjectIds[harborline.id]).toEqual([ledgerCore.id]);
  });
});

describe('show archived', () => {
  it('asks for the archived sessions once, without waiting to be shown', () => {
    const onArchivedTabOpen = vi.fn();
    seedColumn({ store: useAppStore, sessions: all, archived: [old, older] });
    renderBar({ onArchivedTabOpen });
    expect(onArchivedTabOpen).toHaveBeenCalledTimes(1);
  });

  it('adds the archived sessions after the rest, with the archived node', () => {
    mount();
    fireEvent.click(
      within(openMenu()).getByRole('menuitemcheckbox', { name: 'Show archived (2)' }),
    );
    expect(titlesOnScreen().slice(-2).sort()).toEqual([
      'Legacy hook cleanup',
      'Spike: batch settle',
    ]);
    expect(
      screen.getByRole('button', { name: 'Legacy hook cleanup' }).getAttribute('data-node-kind'),
    ).toBe('archived');
  });

  it('hides them again and remembers the choice', () => {
    mount();
    fireEvent.click(
      within(openMenu()).getByRole('menuitemcheckbox', { name: 'Show archived (2)' }),
    );
    expect(storedPrefs(harborline.id)).toMatchObject({ isArchivedShown: true });
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: 'Show archived (2)' }),
    );
    expect(titlesOnScreen()).toHaveLength(3);
  });

  it('keeps archived sessions in a group of their own when the list is grouped', () => {
    mount();
    fireEvent.click(within(openMenu()).getByRole('menuitemradio', { name: 'Project' }));
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: 'Show archived (2)' }),
    );
    closeMenu();
    expect(screen.getByText('Archived')).toBeDefined();
  });
});

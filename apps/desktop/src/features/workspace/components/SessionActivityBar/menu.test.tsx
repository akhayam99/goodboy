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
  vi.useFakeTimers({ now: Date.parse('2026-10-03T12:00:00.000Z'), toFake: ['Date'] });
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
  fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
  return screen.getByRole('dialog', { name: 'Filter sessions' });
};

const GROUP_CHOICES: ReadonlySet<string> = new Set(['None', 'PR state', 'Stage', 'Folder']);

type PickParams = {
  readonly menu: HTMLElement;
  readonly label: string;
};

const pick = ({ menu, label }: PickParams) => {
  const field = GROUP_CHOICES.has(label) ? 'Group' : 'Sort';
  fireEvent.click(within(menu).getByRole('combobox', { name: field }));
  fireEvent.click(screen.getByRole('option', { name: label }));
};

const filterDialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Filter sessions' });

const storedPrefs = (workspaceId: WorkspaceId): unknown =>
  JSON.parse(localStorage.getItem(`${STORAGE_PREFIXES.sessionView}${workspaceId}`) ?? 'null');

describe('the Sessions filter popover', () => {
  it('reads Sort and Group on top, then Filter with checkboxes, then Show archived as a switch', () => {
    mount();
    const menu = openMenu();
    const sections = Array.from(menu.querySelectorAll('[role="group"][aria-label]')).map((group) =>
      group.getAttribute('aria-label'),
    );
    expect(sections.slice(0, 2)).toEqual(['Display', 'Filter']);
    expect(within(menu).getByRole('combobox', { name: 'Sort' })).toBeDefined();
    expect(within(menu).getByRole('combobox', { name: 'Group' })).toBeDefined();
    expect(within(menu).getByRole('group', { name: 'Folder' })).toBeDefined();
    expect(within(menu).queryAllByRole('radio')).toHaveLength(0);
    expect(within(menu).getByRole('switch', { name: 'Show archived, 2' })).toBeDefined();
    expect(within(menu).queryAllByRole('separator')).toHaveLength(0);
    expect(within(menu).getByText('Filter')).toBeDefined();
  });

  it('starts on Needs you first and no grouping, with no Reset', () => {
    mount();
    const menu = openMenu();
    expect(within(menu).getByRole('combobox', { name: 'Sort' }).textContent).toContain(
      'Needs you first',
    );
    expect(within(menu).getByRole('combobox', { name: 'Group' }).textContent).toContain('None');
    expect(within(menu).queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('lists the four sort choices and the four group choices behind their values', () => {
    mount();
    const menu = openMenu();
    fireEvent.click(within(menu).getByRole('combobox', { name: 'Sort' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Needs you first',
      'Alphabetical',
      'Last activity',
      'Created',
    ]);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(within(filterDialog()).getByRole('combobox', { name: 'Group' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'None',
      'PR state',
      'Stage',
      'Folder',
    ]);
  });

  it('closes on Escape and returns focus to its button', () => {
    mount();
    const trigger = screen.getByRole('button', { name: 'Filter sessions' });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Filter sessions' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the page behind it is clicked', () => {
    mount();
    openMenu();
    const backdrop = document.body.querySelector('[data-dropdown-portal] > :first-child');
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole('dialog', { name: 'Filter sessions' })).toBeNull();
  });
});

describe('the funnel', () => {
  it('is named Filter sessions and replaces Options for sessions', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Filter sessions' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Options for sessions' })).toBeNull();
  });

  it('shows no mark until a filter is active, then one dot and never a count', () => {
    mount();
    const trigger = screen.getByRole('button', { name: 'Filter sessions' });
    expect(document.querySelector('[data-filter-dot]')).toBeNull();
    const dialog = openMenu();
    const stages = within(within(dialog).getByRole('group', { name: 'Status' })).getAllByRole(
      'checkbox',
    );
    const firstStage = stages[0];
    if (firstStage === undefined) {
      throw new Error('no stage row');
    }
    fireEvent.click(firstStage);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /^payments-api/ }));
    expect(document.querySelector('[data-filter-dot]')?.getAttribute('data-filter-dot')).toBe(
      'active',
    );
    expect(trigger.closest('.relative')?.textContent).toBe('');
  });

  it('lists only the stages with sessions, each a checkbox with its count, with no project facet for one project', () => {
    seedColumn({
      store: useAppStore,
      sessions: [webhook, copy],
      mounts: [
        [webhook, paymentsApi],
        [copy, paymentsApi],
      ],
    });
    renderBar();
    const dialog = openMenu();
    const status = within(dialog).getByRole('group', { name: 'Status' });
    const rows = within(status).getAllByRole('checkbox');
    expect(rows.map((item) => item.getAttribute('aria-label'))).toEqual(['Building, 2']);
    expect(rows.map((item) => item instanceof HTMLInputElement && item.checked)).toEqual([false]);
    expect(within(dialog).queryByRole('group', { name: 'Folder' })).toBeNull();
  });

  it('keeps only the checked stages, checks the row and offers Reset back to the default', () => {
    seedColumn({ store: useAppStore, sessions: [webhook, ledgerExport] });
    useAppStore.setState({ sessionGithub: { [ledgerExport.id]: mergedGithub() } });
    renderBar();
    const dialog = openMenu();
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    const done = within(dialog).getByRole('checkbox', { name: /^Done/ });
    fireEvent.click(done);
    expect(done instanceof HTMLInputElement && done.checked).toBe(true);
    expect(titlesOnScreen()).toEqual(['Ledger export speedup']);
    expect(storedPrefs(harborline.id)).toMatchObject({ v: 3, statusFilter: ['done'] });
    pick({ menu: dialog, label: 'Alphabetical' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(titlesOnScreen()).toHaveLength(2);
    expect(storedPrefs(harborline.id)).toMatchObject({ sort: 'needsYou', statusFilter: [] });
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
  });
});

const PINNED_AT = 1_790_000_000_000;

describe('what a filter never hides', () => {
  const pinnedSession = sessionOf({
    goal: 'Pinned payments check',
    updatedAt: '2026-09-20T09:00:00.000Z',
  });

  it('keeps a pinned session and the open session and counts what it hides', () => {
    seedColumn({
      store: useAppStore,
      sessions: [webhook, ledgerExport, copy, pinnedSession],
      currentSessionId: copy.id,
      mounts: [
        [webhook, paymentsApi],
        [ledgerExport, ledgerCore],
        [copy, paymentsApi],
        [pinnedSession, ledgerCore],
      ],
    });
    useAppStore.setState({
      sessionPins: {
        [harborline.id]: [{ id: pinnedSession.id, at: PINNED_AT }],
      },
    });
    renderBar();
    const dialog = openMenu();
    const group = within(dialog).getByRole('group', { name: 'Folder' });
    fireEvent.click(within(group).getByRole('checkbox', { name: /^ledger-core/ }));
    expect([...titlesOnScreen()].sort()).toEqual([
      'Cascadia onboarding copy',
      'Ledger export speedup',
      'Pinned payments check',
    ]);
    closeMenu();
    expect(screen.getByText('1 hidden')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/\d+ hidden/)).toBeNull();
    expect(titlesOnScreen()).toHaveLength(4);
  });
});

describe('sort', () => {
  it.each([
    ['Alphabetical', ['Cascadia onboarding copy', 'Fix webhook retries', 'Ledger export speedup']],
    ['Last activity', ['Ledger export speedup', 'Cascadia onboarding copy', 'Fix webhook retries']],
    ['Created', ['Fix webhook retries', 'Cascadia onboarding copy', 'Ledger export speedup']],
    [
      'Needs you first',
      ['Ledger export speedup', 'Cascadia onboarding copy', 'Fix webhook retries'],
    ],
  ])('orders the list by %s', (label, expected) => {
    mount();
    pick({ menu: openMenu(), label: label });
    expect(titlesOnScreen()).toEqual(expected);
  });

  it('remembers the choice for this workspace only', () => {
    mount();
    pick({ menu: openMenu(), label: 'Alphabetical' });
    expect(storedPrefs(harborline.id)).toMatchObject({ v: 3, sort: 'goal' });
    expect(storedPrefs('workspace-cascadia' as WorkspaceId)).toBeNull();
  });

  it('comes back after the window reloads', () => {
    const first = mount();
    pick({ menu: openMenu(), label: 'Alphabetical' });
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
        button.hasAttribute('aria-expanded') &&
        button.getAttribute('aria-label') !== 'Filter sessions',
    )
    .map((button) => button.textContent ?? '');

describe('group', () => {
  it('groups by project with the project name and a count', () => {
    mount();
    pick({ menu: openMenu(), label: 'Folder' });
    closeMenu();
    expect(groupHeaders()).toEqual(['ledger-core', 'payments-api2']);
  });

  it('groups by stage and keeps the sessions in each group', () => {
    mount();
    pick({ menu: openMenu(), label: 'Stage' });
    closeMenu();
    expect(groupHeaders()).toHaveLength(1);
    expect(titlesOnScreen()).toHaveLength(3);
  });

  it('folds a group from its header', () => {
    mount();
    pick({ menu: openMenu(), label: 'Folder' });
    closeMenu();
    fireEvent.click(screen.getByRole('button', { name: /^payments-api/ }));
    expect(titlesOnScreen()).toEqual(['Ledger export speedup']);
  });

  it('keeps finished work collapsed under Stage until its labeled count is opened', () => {
    seedColumn({ store: useAppStore, sessions: [webhook, ledgerExport] });
    useAppStore.setState({ sessionGithub: { [ledgerExport.id]: mergedGithub() } });
    renderBar();
    pick({ menu: openMenu(), label: 'Stage' });
    closeMenu();
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Ledger export speedup' })).toBeNull();
    fireEvent.click(done);
    expect(done.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Ledger export speedup' })).toBeDefined();
  });

  it('returns to one flat list on None', () => {
    mount();
    pick({ menu: openMenu(), label: 'Folder' });
    pick({ menu: filterDialog(), label: 'None' });
    closeMenu();
    expect(groupHeaders()).toHaveLength(0);
    expect(titlesOnScreen()).toHaveLength(3);
  });
});

describe('filter by project', () => {
  it('lists the projects of the open sessions with their counts', () => {
    mount();
    const group = within(openMenu()).getByRole('group', { name: 'Folder' });
    expect(
      within(group)
        .getAllByRole('checkbox')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['ledger-core, 1', 'payments-api, 2']);
  });

  it('keeps only the sessions of the checked project and restores them when unchecked', () => {
    mount();
    const group = within(openMenu()).getByRole('group', { name: 'Folder' });
    fireEvent.click(within(group).getByRole('checkbox', { name: /^payments-api/ }));
    expect(titlesOnScreen()).toEqual(['Cascadia onboarding copy', 'Fix webhook retries']);
    fireEvent.click(within(group).getByRole('checkbox', { name: /^payments-api/ }));
    expect(titlesOnScreen()).toHaveLength(3);
  });

  it('shares its choice with the board filter', () => {
    mount();
    const group = within(openMenu()).getByRole('group', { name: 'Folder' });
    fireEvent.click(within(group).getByRole('checkbox', { name: /^ledger-core/ }));
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
    fireEvent.click(within(openMenu()).getByRole('switch', { name: 'Show archived, 2' }));
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
    fireEvent.click(within(openMenu()).getByRole('switch', { name: 'Show archived, 2' }));
    expect(storedPrefs(harborline.id)).toMatchObject({ isArchivedShown: true });
    fireEvent.click(within(filterDialog()).getByRole('switch', { name: 'Show archived, 2' }));
    expect(titlesOnScreen()).toHaveLength(3);
  });

  it('keeps archived sessions in a group of their own when the list is grouped', () => {
    mount();
    pick({ menu: openMenu(), label: 'Folder' });
    fireEvent.click(within(filterDialog()).getByRole('switch', { name: 'Show archived, 2' }));
    closeMenu();
    expect(screen.getByText('Archived')).toBeDefined();
  });
});

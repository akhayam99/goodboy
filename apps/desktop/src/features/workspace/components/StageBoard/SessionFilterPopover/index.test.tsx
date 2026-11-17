// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  harborline,
  ledgerCore,
  notifyRelay,
  renderBoard,
  seedColumn,
  sessionOf,
} from '../../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const running = sessionOf({ goal: 'Fix webhook retries' });
const failed = sessionOf({ goal: 'Notify relay backoff' });
const ledgerIdle = sessionOf({ goal: 'Backfill ledger balances' });
const relayIdle = sessionOf({ goal: 'Rotate the relay signing key' });
const all = [running, failed, ledgerIdle, relayIdle];

const mountBoard = () => {
  seedColumn({
    store: useAppStore,
    sessions: all,
    mounts: [
      [running, ledgerCore],
      [failed, notifyRelay],
      [ledgerIdle, ledgerCore],
      [relayIdle, notifyRelay],
    ],
  });
  return renderBoard({ store: useAppStore });
};

const openPopover = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
  return screen.getByRole('dialog', { name: 'Filter sessions' });
};

const goalsOnScreen = (): ReadonlyArray<string> =>
  all
    .map((session) => session.goal)
    .filter((goal) => screen.queryByRole('button', { name: goal }) !== null)
    .sort();

const tickFolder = ({ dialog, name }: { readonly dialog: HTMLElement; readonly name: string }) =>
  fireEvent.click(
    within(within(dialog).getByRole('group', { name: 'Project' })).getByRole('checkbox', { name }),
  );

const prefs = () => useAppStore.getState().sessionViewPrefs[harborline.id];

const selectedFolders = () => useAppStore.getState().selectedProjectIds[harborline.id] ?? [];

const ALL_GOALS = all.map((session) => session.goal).sort();

describe('the Board filter', () => {
  it('lists every session and offers no Reset while nothing is filtered', () => {
    mountBoard();
    const dialog = openPopover();

    expect(goalsOnScreen()).toEqual(ALL_GOALS);
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(document.querySelector('[data-filter-dot="active"]')).toBeNull();
    expect(screen.queryByText(/hidden$/)).toBeNull();
  });

  it('offers Sort and Project only: the lanes are the status, the Archived lane the archive', () => {
    mountBoard();
    const dialog = openPopover();

    within(dialog).getByRole('combobox', { name: 'Sort' });
    expect(within(dialog).queryByRole('combobox', { name: 'Group' })).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Status' })).toBeNull();
    expect(within(dialog).queryByRole('switch', { name: /Show archived/ })).toBeNull();
  });

  it('narrows the Board to one folder when its Project box is ticked', () => {
    mountBoard();
    const dialog = openPopover();

    tickFolder({ dialog, name: 'ledger-core, 2' });

    expect(selectedFolders()).toEqual([ledgerCore.id]);
    expect(goalsOnScreen()).toEqual(['Backfill ledger balances', 'Fix webhook retries']);
    expect(document.querySelector('[data-filter-dot="active"]')).not.toBeNull();
  });

  it('puts a ticked box back to unticked on a second click', () => {
    mountBoard();
    const dialog = openPopover();

    tickFolder({ dialog, name: 'ledger-core, 2' });
    tickFolder({ dialog, name: 'ledger-core, 2' });

    expect(selectedFolders()).toEqual([]);
    expect(goalsOnScreen()).toEqual(ALL_GOALS);
  });

  it('Reset drops the sort and the folder filter together', () => {
    mountBoard();
    const dialog = openPopover();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('option', { name: 'Alphabetical' }));
    tickFolder({ dialog, name: 'ledger-core, 2' });
    expect(prefs()?.sort).toBe('goal');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));

    expect(prefs()?.sort).toBe('needsYou');
    expect(selectedFolders()).toEqual([]);
    expect(goalsOnScreen()).toEqual(ALL_GOALS);
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(document.querySelector('[data-filter-dot="active"]')).toBeNull();
  });
});

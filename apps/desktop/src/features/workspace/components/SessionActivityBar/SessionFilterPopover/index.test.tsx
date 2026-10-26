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
  failedState,
  harborline,
  ledgerCore,
  notifyRelay,
  renderBar,
  runningState,
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

const running = sessionOf({ goal: 'Fix webhook retries', state: runningState() });
const failed = sessionOf({ goal: 'Notify relay backoff', state: failedState() });
const ledgerIdle = sessionOf({ goal: 'Backfill ledger balances' });
const relayIdle = sessionOf({ goal: 'Rotate the relay signing key' });
const all = [running, failed, ledgerIdle, relayIdle];

const mountColumn = () => {
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
  return renderBar();
};

const openPopover = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
  return screen.getByRole('dialog', { name: 'Filter sessions' });
};

const goalsOnScreen = (): ReadonlyArray<string> =>
  all
    .map((session) => session.goal)
    .filter((goal) => screen.queryByRole('option', { name: goal }) !== null)
    .sort();

const tickFolder = ({ dialog, name }: { readonly dialog: HTMLElement; readonly name: string }) =>
  fireEvent.click(
    within(within(dialog).getByRole('group', { name: 'Folder' })).getByRole('checkbox', { name }),
  );

const prefs = () => useAppStore.getState().sessionViewPrefs[harborline.id];

const selectedFolders = () => useAppStore.getState().selectedProjectIds[harborline.id] ?? [];

const ALL_GOALS = all.map((session) => session.goal).sort();

describe('the session filter popover', () => {
  it('lists every session and offers no Reset while nothing is filtered', () => {
    mountColumn();
    const dialog = openPopover();

    expect(goalsOnScreen()).toEqual(ALL_GOALS);
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(document.querySelector('[data-filter-dot="active"]')).toBeNull();
    expect(screen.queryByText(/hidden$/)).toBeNull();
  });

  it('narrows the column to one stage when its Status box is ticked', () => {
    mountColumn();
    const dialog = openPopover();

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Running, 1' }));

    expect(prefs()?.statusFilter).toEqual(['running']);
    expect(goalsOnScreen()).toEqual(['Fix webhook retries']);
    expect(screen.getByText('3 hidden')).toBeDefined();
    expect(document.querySelector('[data-filter-dot="active"]')).not.toBeNull();
  });

  it('narrows the column to one folder when its Folder box is ticked', () => {
    mountColumn();
    const dialog = openPopover();

    tickFolder({ dialog, name: 'ledger-core, 2' });

    expect(selectedFolders()).toEqual([ledgerCore.id]);
    expect(goalsOnScreen()).toEqual(['Backfill ledger balances', 'Fix webhook retries']);
    expect(screen.getByText('2 hidden')).toBeDefined();
  });

  it('puts a ticked box back to unticked on a second click', () => {
    mountColumn();
    const dialog = openPopover();

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Running, 1' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Running, 1' }));

    expect(prefs()?.statusFilter).toEqual([]);
    expect(goalsOnScreen()).toEqual(ALL_GOALS);
  });

  it('Reset drops the stage and the folder filters together', () => {
    mountColumn();
    const dialog = openPopover();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Running, 1' }));
    tickFolder({ dialog, name: 'ledger-core, 2' });
    expect(goalsOnScreen()).toEqual(['Fix webhook retries']);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));

    expect(prefs()?.statusFilter).toEqual([]);
    expect(selectedFolders()).toEqual([]);
    expect(goalsOnScreen()).toEqual(ALL_GOALS);
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(document.querySelector('[data-filter-dot="active"]')).toBeNull();
  });

  it('Clear next to the hidden count drops both filters and brings the sessions back', () => {
    mountColumn();
    const dialog = openPopover();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Running, 1' }));
    tickFolder({ dialog, name: 'ledger-core, 2' });
    expect(screen.getByText('3 hidden')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(prefs()?.statusFilter).toEqual([]);
    expect(selectedFolders()).toEqual([]);
    expect(screen.queryByText(/hidden$/)).toBeNull();
    expect(goalsOnScreen()).toEqual(ALL_GOALS);
  });
});
